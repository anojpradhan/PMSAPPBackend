import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getData(userId: number) {
    const cacheKey = `dashboard:${userId}`;

    //Try Redis cache first
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      this.logger.warn('Redis cache failed, continuing without it', err);
    }

    //Fetch from DB using Prisma
    let totalProducts = 0;
    let totalSales = 0;
    let totalRevenue = 0;
    let lowStockProducts: any[] = [];

    try {
      const result = await this.prisma.$transaction([
        this.prisma.product.count({ where: { userId } }),
        this.prisma.sale.count({ where: { userId } }),
        this.prisma.sale.aggregate({
          where: { userId },
          _sum: { total: true },
        }),
        this.prisma.product.findMany({
          where: { userId, stockQuantity: { lt: 5 } },
          select: { id: true, name: true, stockQuantity: true },
        }),
      ]);

      totalProducts = result[0] ?? 0;
      totalSales = result[1] ?? 0;
      totalRevenue = result[2]?._sum?.total ?? 0;
      lowStockProducts = result[3] ?? [];
    } catch (err) {
      this.logger.error('Prisma transaction failed', err);
      // Return fallback values
      return { totalProducts, totalSales, totalRevenue, lowStockProducts };
    }

    const data = { totalProducts, totalSales, totalRevenue, lowStockProducts };

    //saving to redis
    try {
      await this.redis.set(cacheKey, JSON.stringify(data), 'EX', 60);
    } catch (err) {
      this.logger.warn('Failed to set Redis cache', err);
    }

    return data;
  }
}
