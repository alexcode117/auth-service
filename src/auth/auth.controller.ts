import { Controller, Post, Body, Get, UseGuards, Request, UnauthorizedException, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('register')
  register(
    @Body() body: { email: string; password: string; name: string },
  ) {
    return this.authService.register(body);
  }

  @Post('login')
  login(
    @Body() body: { email: string; password: string },
  ) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  async refreshTokens(@Body() body: { userId: number; refresh_token: string }) {
  const user = await this.usersService.findById(body.userId);
  if (!user || !user.refreshToken)
    throw new UnauthorizedException('Usuario no autorizado');

  const isMatch = await bcrypt.compare(body.refresh_token, user.refreshToken);
  if (!isMatch)
    throw new UnauthorizedException('Token inválido o caducado');

  const tokens = await this.authService.generateTokens(user.id, user.email);
  const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
  await this.usersService.updateRefreshToken(user.id, hashedRefreshToken);

  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  };
  }

  @UseGuards(JwtAuthGuard) // o tu guardia de acceso personalizado
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
}


