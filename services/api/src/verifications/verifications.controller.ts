import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { VerificationsService } from './verifications.service';

class SubmitVerificationDto {
  @IsString()
  registrationNumber!: string;

  @IsString()
  programmeId!: string;

  @IsString()
  facultyId!: string;

  @IsOptional()
  @IsString()
  evidenceFileId?: string;
}

@Controller('verifications')
@UseGuards(AuthGuard)
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Post('student')
  submit(@CurrentActor() actor: Actor, @Body() body: SubmitVerificationDto) {
    return this.verifications.submit(actor.personId, body);
  }

  @Get('student/me')
  mine(@CurrentActor() actor: Actor) {
    return this.verifications.mine(actor.personId);
  }
}
