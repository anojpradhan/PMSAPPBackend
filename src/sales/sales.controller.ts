import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { User } from 'src/auth/helper/user.decorator'; // import your decorator

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('products')
  getProducts(@User('userId') userId: number) {
    return this.salesService.getAllProducts(userId);
  }

  @Post()
  create(@User('userId') userId: number, @Body() dto: CreateSaleDto) {
    return this.salesService.create(userId, dto);
  }

  @Get()
  getAll(@User('userId') userId: number, @Query('page') page: string) {
    const pageNumber = page ? parseInt(page, 10) : 1;
    return this.salesService.getAll(userId, pageNumber);
  }

  @Get(':id')
  getOne(
    @User('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.salesService.getById(userId, id);
  }

  @Patch(':id')
  update(
    @User('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.salesService.update(userId, id, dto);
  }

  @Delete(':id')
  delete(
    @User('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.salesService.delete(userId, id);
  }
}
