import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
  Req,
  Delete,
  Param,
  ForbiddenException,
  Res,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';
import { Request as ExpressRequest, Response } from 'express';
import { Throttle } from '@nestjs/throttler';

@Throttle({ default: { limit: 10, ttl: 60 } })
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  @Post('register')
  register(@Body() body: { email: string; password: string; name: string }) {
    return this.authService.register(body);
  }

  @Post('login')
    async login(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateUser(req.body.email, req.body.password);
    if (!user) throw new UnauthorizedException('Credenciales inválidas');

    const { accessToken, refreshToken } = await this.authService.login(user, req);
  
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  
    return { accessToken };
  }
  

  @Post('refresh')
  async refresh(@Req() req: ExpressRequest, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies['refresh_token'];
    if (!token) throw new UnauthorizedException('No hay refresh token');
  
    const { accessToken, refreshToken } = await this.authService.refreshToken(token);
  
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  
    return { accessToken };
  }
  

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Req() req) {
    const userId = req.user.sub; // JWT debe tener el ID del usuario
    return this.authService.logout(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@Req() req) {
    const userId = req.user.sub;
    return this.prisma.session.findMany({
      where: { userId },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') sessionId: number, @Req() req) {
    const userId = req.user.sub;

    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new ForbiddenException('No autorizado para eliminar esta sesión');
    }

    await this.prisma.session.delete({ where: { id: sessionId } });

    return { message: 'Sesión revocada correctamente' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions')
  async logoutAll(@Req() req) {
    const userId = req.user.sub;
    await this.prisma.session.deleteMany({
      where: { userId },
    });
    return { message: 'Todas las sesiones cerradas' };
  }
}
