import { Controller, Get, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { User } from 'src/auth/helper/user.decorator';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('get')
  findOne(@User('userId') userId: number) {
    return this.dashboardService.getData(userId);
  }
}
