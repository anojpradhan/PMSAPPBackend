import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, createProductDto: CreateProductDto) {
    try {
      const existingSku = await this.prisma.product.findFirst({
        where: {
          userId,
          sku: createProductDto.sku,
        },
      });

      if (existingSku) {
        throw new BadRequestException(
          `Product with SKU "${createProductDto.sku}" already exists`,
        );
      }

      return await this.prisma.product.create({
        data: {
          ...createProductDto,
          userId,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new InternalServerErrorException('Failed to create product');
    }
  }

  async findAll(userId: number, page = 1, limit = 8) {
    try {
      const skip = (page - 1) * limit;

      const data2 = await this.prisma.product.findMany({
        where: { userId },
      });

      const [products, totalCount] = await Promise.all([
        this.prisma.product.findMany({
          where: { userId },
          skip,
          take: limit,
        }),
        this.prisma.product.count({ where: { userId } }),
      ]);

      return {
        data: products,
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch products');
    }
  }

  async findOne(userId: number, id: number) {
    try {
      const product = await this.prisma.product.findFirst({
        where: {
          id,
          userId,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      return product;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to fetch product');
    }
  }

  async update(userId: number, id: number, updateProductDto: UpdateProductDto) {
    try {
      const product = await this.findOne(userId, id);

      if (updateProductDto.sku) {
        const existingSku = await this.prisma.product.findFirst({
          where: {
            userId,
            sku: updateProductDto.sku,
            NOT: { id },
          },
        });

        if (existingSku) {
          throw new BadRequestException(
            `Product with SKU "${updateProductDto.sku}" already exists`,
          );
        }
      }

      return await this.prisma.product.update({
        where: { id: product.id },
        data: updateProductDto,
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update product');
    }
  }

  async remove(userId: number, id: number) {
    try {
      const product = await this.findOne(userId, id);

      await this.prisma.product.delete({
        where: { id: product.id },
      });

      return { message: 'Product deleted successfully' };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('Failed to delete product');
    }
  }
}
