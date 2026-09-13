import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public() @Post('login')
  async login(@Body() input: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(input);
    response.cookie('ffai_refresh', result.refreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/auth' });
    return { accessToken: result.accessToken, user: result.user };
  }
  @Public() @Post('refresh')
  refresh(@Req() request: Request) {
    const token = request.cookies?.ffai_refresh as string | undefined;
    if (!token) return this.auth.refresh('');
    return this.auth.refresh(token);
  }
  @Public() @Post('logout')
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.logout(request.cookies?.ffai_refresh as string | undefined);
    response.clearCookie('ffai_refresh', { path: '/api/v1/auth' });
    return result;
  }
}

