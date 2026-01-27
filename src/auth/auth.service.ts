import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LoginDto } from './dto/LoginDto';
import { RegisterDto } from './dto/RegisterDto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { UsersService } from 'src/users/users.service';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: {
        username: loginDto.username, // we search by username
      },
      select: {
        id: true,
        name: true, // include user's real name
        password: true, // needed to compare
        updated_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User with username ${loginDto.username} not found`,
      );
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.password,
    );
    if (!isPasswordValid) {
      throw new BadRequestException('Invalid credentials');
    }

    const token = await this.jwtService.signAsync({
      id: user.id,
      updated: user.updated_at,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
      },
      token,
    };
  }

  async register(registerDto: RegisterDto) {
    const user = await this.userService.create(registerDto);

    const token = await this.jwtService.signAsync({
      id: user.id,
      updated: user.updated_at,
    });

    return {
      user: {
        id: user.id,
        name: user.name,
      },
      token,
    };
  }
}
