import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('signup')
  async signup(@Body() dto: SignupDto, @Res({ passthrough: true }) res: Response): Promise<{ wsToken: string }> {
    return this.auth.signup(dto, res);
  }

  @Public()
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<{ wsToken: string }> {
    return this.auth.login(dto, res);
  }

  @Public()
  @Post('logout')
  logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): void {
    this.auth.logout(req, res);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ wsToken: string }> {
    const refreshToken = req.cookies?.refresh as string | undefined;
    return this.auth.refresh(res, refreshToken);
  }

  @Get('me')
  async me(@CurrentUser('id') userId: string, @CurrentUser('tenantId') tenantId: string): Promise<Record<string, unknown>> {
    return this.auth.me(userId, tenantId);
  }
}
