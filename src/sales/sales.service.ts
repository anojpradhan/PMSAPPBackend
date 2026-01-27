import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import Redis from 'ioredis';

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  // Get all products of the user (for dropdown)
  async getAllProducts(userId: number) {
    const data = await this.prisma.product.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    return this.prisma.product.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  // Create a new sale
  async create(userId: number, dto: CreateSaleDto) {
    if (!dto.items || dto.items.length === 0)
      throw new BadRequestException('Sale must have at least one item');

    const productIds = dto.items.map((item) => item.productId);

    // Fetch products belonging to this user
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, userId },
    });

    if (products.length !== productIds.length)
      throw new ForbiddenException('One or more products do not belong to you');

    // Check stock availability
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product)
        throw new NotFoundException(
          `Product with ID ${item.productId} not found`,
        );

      if (item.quantity > product.stockQuantity) {
        throw new BadRequestException(
          `Not enough stock for "${product.name}". You requested ${item.quantity}, but only ${product.stockQuantity} available.`,
        );
      }
    }

    // Calculate total amount
    const total = dto.items.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0,
    );

    // Transaction: create sale + items + update stock
    const sale = await this.prisma.$transaction(async (prisma) => {
      const createdSale = await prisma.sale.create({ data: { userId, total } });

      const itemsData = dto.items.map((item) => ({
        saleId: createdSale.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      }));

      await prisma.saleItem.createMany({ data: itemsData });

      // Update stock
      for (const item of dto.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      return prisma.sale.findUnique({
        where: { id: createdSale.id },
        include: { items: { include: { product: true } } },
      });
    });

    // Invalidating dashboard cache
    await this.redis.del(`dashboard:${userId}`);

    return sale;
  }

  // Get sale by ID
  async getById(userId: number, saleId: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: { include: { product: true } } },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.userId !== userId) throw new ForbiddenException('Access denied');
    return sale;
  }

  // Get all sales (paginated)
  async getAll(userId: number, page: number = 1, limit: number = 8) {
    const [sales, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where: { userId },
        include: { items: { include: { product: true } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.sale.count({ where: { userId } }),
    ]);

    return {
      data: sales,
      meta: {
        total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };
  }

  // Update sale
  async update(userId: number, saleId: number, dto: UpdateSaleDto) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.userId !== userId) throw new ForbiddenException('Access denied');

    const updatedSale = await this.prisma.$transaction(async (prisma) => {
      let total = sale.total;

      if (dto.items && dto.items.length > 0) {
        // Restore old stock
        for (const oldItem of sale.items) {
          await prisma.product.update({
            where: { id: oldItem.productId },
            data: { stockQuantity: { increment: oldItem.quantity } },
          });
        }

        const productIds = dto.items.map((i) => i.productId);
        const products = await prisma.product.findMany({
          where: { id: { in: productIds }, userId },
        });

        if (products.length !== productIds.length)
          throw new ForbiddenException(
            'One or more products do not belong to you',
          );

        for (const item of dto.items) {
          const product = products.find((p) => p.id === item.productId);
          if (!product)
            throw new NotFoundException(
              `Product with ID ${item.productId} not found`,
            );
          if (item.quantity > product.stockQuantity)
            throw new BadRequestException(
              `Not enough stock for "${product.name}". You requested ${item.quantity}, but only ${product.stockQuantity} available.`,
            );
        }

        await prisma.saleItem.deleteMany({ where: { saleId } });

        const itemsData = dto.items.map((item) => ({
          saleId,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        }));

        await prisma.saleItem.createMany({ data: itemsData });

        for (const item of dto.items) {
          await prisma.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } },
          });
        }

        total = itemsData.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0,
        );
      }

      await prisma.sale.update({ where: { id: saleId }, data: { total } });

      return prisma.sale.findUnique({
        where: { id: saleId },
        include: { items: { include: { product: true } } },
      });
    });

    // ✅ invalidate AFTER transaction
    await this.redis.del(`dashboard:${userId}`);

    return updatedSale;
  }

  // Delete sale
  async delete(userId: number, saleId: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.userId !== userId) throw new ForbiddenException('Access denied');

    return this.prisma.$transaction(async (prisma) => {
      // Restore stock
      for (const item of sale.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      await prisma.saleItem.deleteMany({ where: { saleId } });
      await prisma.sale.delete({ where: { id: saleId } });

      await this.redis.del(`dashboard:${userId}`);

      return { message: 'Sale deleted successfully' };
    });
  }
}
