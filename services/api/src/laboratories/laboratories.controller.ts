import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { LaboratoriesService } from './laboratories.service';

class CreateLabDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  objective?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  safetyLevel?: string;

  @IsOptional()
  @IsString()
  safetyInstructions?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class LaboratoriesController {
  constructor(private readonly laboratories: LaboratoriesService) {}

  @Get('course-offerings/:courseOfferingId/laboratories')
  list(@CurrentActor() actor: Actor, @Param('courseOfferingId') courseOfferingId: string) {
    return this.laboratories.list(actor.personId, courseOfferingId);
  }

  @Post('course-offerings/:courseOfferingId/laboratories')
  create(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Body() body: CreateLabDto,
  ) {
    return this.laboratories.create(actor.personId, courseOfferingId, body);
  }

  @Get('laboratories/:laboratoryId')
  get(@CurrentActor() actor: Actor, @Param('laboratoryId') laboratoryId: string) {
    return this.laboratories.get(actor.personId, laboratoryId);
  }

  @Patch('laboratories/:laboratoryId')
  update(
    @CurrentActor() actor: Actor,
    @Param('laboratoryId') laboratoryId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.laboratories.update(actor.personId, laboratoryId, body);
  }

  @Post('laboratories/:laboratoryId/publish')
  publish(@CurrentActor() actor: Actor, @Param('laboratoryId') laboratoryId: string) {
    return this.laboratories.publish(actor.personId, laboratoryId);
  }
}
