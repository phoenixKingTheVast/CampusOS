import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SubmissionMode } from '@prisma/client';
import { IsArray, IsEnum, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { AssessmentsService } from './assessments.service';

class CreateAssessmentDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  assessmentType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsString()
  dueAt?: string;

  @IsOptional()
  @IsString()
  startAt?: string;

  @IsOptional()
  @IsString()
  endAt?: string;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  topics?: string[];

  @IsOptional()
  @IsEnum(SubmissionMode)
  submissionMode?: SubmissionMode;

  @IsOptional()
  @IsString()
  externalSubmissionUrl?: string;

  @IsOptional()
  @IsArray()
  resourceIds?: string[];
}

@Controller()
@UseGuards(AuthGuard)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('course-offerings/:courseOfferingId/assessments')
  list(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Query('type') type?: string,
  ) {
    return this.assessments.list(actor.personId, courseOfferingId, type);
  }

  @Post('course-offerings/:courseOfferingId/assessments')
  create(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Body() body: CreateAssessmentDto,
  ) {
    return this.assessments.create(actor.personId, courseOfferingId, body);
  }

  @Get('assessments/:assessmentId')
  get(@CurrentActor() actor: Actor, @Param('assessmentId') assessmentId: string) {
    return this.assessments.get(actor.personId, assessmentId);
  }

  @Patch('assessments/:assessmentId')
  update(
    @CurrentActor() actor: Actor,
    @Param('assessmentId') assessmentId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.assessments.update(actor.personId, assessmentId, body);
  }

  @Post('assessments/:assessmentId/publish')
  publish(@CurrentActor() actor: Actor, @Param('assessmentId') assessmentId: string) {
    return this.assessments.publish(actor.personId, assessmentId);
  }

  @Post('assessments/:assessmentId/cancel')
  cancel(@CurrentActor() actor: Actor, @Param('assessmentId') assessmentId: string) {
    return this.assessments.cancel(actor.personId, assessmentId);
  }

  @Post('assessments/:assessmentId/archive')
  archive(@CurrentActor() actor: Actor, @Param('assessmentId') assessmentId: string) {
    return this.assessments.archive(actor.personId, assessmentId);
  }
}
