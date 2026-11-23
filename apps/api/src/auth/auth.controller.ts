import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Public } from '../common/decorators';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { readRefreshCookie, readSessionCookie, REFRESH_COOKIE, SESSION_COOKIE, SESSION_COOKIE_PATH } from './session-cookie';

function setSessionCookie(response: Response, token: string, refreshToken: string, expiresAt: Date) {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: SESSION_COOKIE_PATH,
  } as const;
  response.cookie(SESSION_COOKIE, token, { ...options, expires: expiresAt });
  response.cookie(REFRESH_COOKIE, refreshToken, { ...options, maxAge: 30 * 24 * 60 * 60 * 1000 });
}

function clearSessionCookie(response: Response) {
  response.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: SESSION_COOKIE_PATH,
  });
  response.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: SESSION_COOKIE_PATH });
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.register(dto);
    setSessionCookie(response, session.token, session.refreshToken, session.expiresAt);
    return { authenticated: true };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.login(dto);
    setSessionCookie(response, session.token, session.refreshToken, session.expiresAt);
    return { authenticated: true };
  }

  @Public()
  @HttpCode(200)
  @Post('dev-login')
  async devLogin(@Res({ passthrough: true }) response: Response) {
    const session = await this.auth.devLogin();
    setSessionCookie(response, session.token, session.refreshToken, session.expiresAt);
    return { authenticated: true };
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user);
  }

  @HttpCode(200)
  @Public()
  @Post('refresh')
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readRefreshCookie(request);
    if (!token) throw new UnauthorizedException('Sessão ausente');
    const session = await this.auth.refresh(token);
    setSessionCookie(response, session.token, session.refreshToken, session.expiresAt);
    return { authenticated: true };
  }

  @Get('sessions')
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id);
  }

  @Delete('sessions/:id')
  revokeSession(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.auth.revokeSession(user.id, id);
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(user.sessionId);
    clearSessionCookie(response);
    return { success: true };
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.revokeAllSessions(user.sessionId);
    clearSessionCookie(response);
    return result;
  }
}
