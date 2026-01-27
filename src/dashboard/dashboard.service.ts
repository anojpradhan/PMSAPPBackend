import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private redis: Redis,
  ) {}

  async getData(userId: number) {
    const cacheKey = `dashboard:${userId}`;

    // checking cache
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
    const [totalProducts, totalSales, revenueResult, lowStockProducts] =
      await this.prisma.$transaction([
        // Total products
        this.prisma.product.count({
          where: { userId },
        }),

        // Total sales count
        this.prisma.sale.count({
          where: { userId },
        }),

        // Total revenue
        this.prisma.sale.aggregate({
          where: { userId },
          _sum: { total: true },
        }),

        // Low stock products (less than 5)
        this.prisma.product.findMany({
          where: {
            userId,
            stockQuantity: { lt: 5 },
          },
          select: {
            id: true,
            name: true,
            stockQuantity: true,
          },
        }),
      ]);

    const data = {
      totalProducts,
      totalSales,
      totalRevenue: revenueResult._sum.total || 0,
      lowStockProducts,
    };

    // saving in redis
    await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60);

    return data;
  }
}
