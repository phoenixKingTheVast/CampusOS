import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AnnouncementPriority } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { AnnouncementsService } from './announcements.service';

class CreateAnnouncementDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(3)
  body!: string;

  @IsOptional()
  @IsEnum(AnnouncementPriority)
  priority?: AnnouncementPriority;
}

@Controller()
@UseGuards(AuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get('course-offerings/:courseOfferingId/announcements')
  list(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
  ) {
    return this.announcements.list(actor.personId, courseOfferingId);
  }

  @Post('course-offerings/:courseOfferingId/announcements')
  create(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Body() body: CreateAnnouncementDto,
  ) {
    return this.announcements.create(actor.personId, courseOfferingId, body);
  }

  @Get('announcements/:announcementId')
  get(@CurrentActor() actor: Actor, @Param('announcementId') announcementId: string) {
    return this.announcements.get(actor.personId, announcementId);
  }

  @Patch('announcements/:announcementId')
  update(
    @CurrentActor() actor: Actor,
    @Param('announcementId') announcementId: string,
    @Body() body: CreateAnnouncementDto,
  ) {
    return this.announcements.update(actor.personId, announcementId, body);
  }

  @Post('announcements/:announcementId/archive')
  archive(@CurrentActor() actor: Actor, @Param('announcementId') announcementId: string) {
    return this.announcements.archive(actor.personId, announcementId);
  }

  @Post('announcements/:announcementId/read')
  read(@CurrentActor() actor: Actor, @Param('announcementId') announcementId: string) {
    return this.announcements.markRead(actor.personId, announcementId);
  }
}
