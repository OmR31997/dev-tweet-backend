import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Create account and return access + refresh tokens' })
  register(@Body() payload: RegisterDto) {
    return this.authService.register(payload);
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Sign in with email and password' })
  login(@Body() payload: LoginDto) {
    return this.authService.login(payload);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password-reset email' })
  forgotPassword(@Body() payload: ForgotPasswordDto) {
    return this.authService.forgotPassword(payload);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using emailed token' })
  resetPassword(@Body() payload: ResetPasswordDto) {
    return this.authService.resetPassword(payload);
  }

  @Public()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  refresh(@Body() payload: RefreshDto) {
    return this.authService.refresh(payload.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('logout')
  @ApiOperation({ summary: 'Invalidate refresh token for the current session' })
  logout(@CurrentUser() user: { userId: string }) {
    return this.authService.logout(user.userId);
  }
}
