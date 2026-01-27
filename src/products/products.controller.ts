import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Req,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { User } from 'src/auth/helper/user.decorator';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @User('userId') userId: number,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.productsService.create(userId, createProductDto);
  }

  @Get()
  async findAll(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @User('userId') userId: number,
  ) {
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 8;

    return this.productsService.findAll(userId, pageNum, limitNum);
  }

  @Get(':id')
  findOne(
    @User('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productsService.findOne(userId, id);
  }

  @Patch(':id')
  update(
    @User('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(userId, id, updateProductDto);
  }

  @Delete(':id')
  remove(
    @User('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.productsService.remove(userId, id);
  }
}
