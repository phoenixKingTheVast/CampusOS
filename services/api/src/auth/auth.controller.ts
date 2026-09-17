import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, Length, Matches } from 'class-validator';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { CurrentActor, Actor } from '../common/current-actor.decorator';

class RequestOtpDto {
  @IsString()
  phoneNumber!: string;
}

class VerifyOtpDto {
  @IsString()
  challengeId!: string;

  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  otp!: string;
}

class RefreshDto {
  @IsString()
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() body: RequestOtpDto) {
    return this.auth.requestOtp(body.phoneNumber);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtp(body.challengeId, body.otp);
  }

  @Post('refresh')
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  logout(@CurrentActor() actor: Actor) {
    return this.auth.logout(actor.sessionId, actor.personId);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  sessions(@CurrentActor() actor: Actor) {
    return this.auth.listSessions(actor.personId, actor.sessionId);
  }

  @Post('sessions/:sessionId/revoke')
  @UseGuards(AuthGuard)
  revoke(@CurrentActor() actor: Actor, @Param('sessionId') sessionId: string) {
    return this.auth.revokeSession(actor.personId, sessionId);
  }
}
