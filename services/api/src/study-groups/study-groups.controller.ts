import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { StudyGroupsService } from './study-groups.service';

class CreateStudyGroupDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class StudyGroupsController {
  constructor(private readonly groups: StudyGroupsService) {}

  @Get('course-offerings/:courseOfferingId/study-groups')
  list(@CurrentActor() actor: Actor, @Param('courseOfferingId') courseOfferingId: string) {
    return this.groups.listForCourse(actor.personId, courseOfferingId);
  }

  @Post('course-offerings/:courseOfferingId/study-groups')
  create(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Body() body: CreateStudyGroupDto,
  ) {
    return this.groups.create(actor.personId, courseOfferingId, body);
  }

  @Get('study-groups/:studyGroupId')
  get(@CurrentActor() actor: Actor, @Param('studyGroupId') studyGroupId: string) {
    return this.groups.get(actor.personId, studyGroupId);
  }

  @Post('study-groups/:studyGroupId/join')
  join(@CurrentActor() actor: Actor, @Param('studyGroupId') studyGroupId: string) {
    return this.groups.join(actor.personId, studyGroupId);
  }
}
