import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  OrganizationMembershipPolicy,
  OrganizationTypeKey,
  ReportReason,
} from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { OrganizationsService } from './organizations.service';

class CreateOrganizationDto {
  @IsString()
  @MinLength(3)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(OrganizationTypeKey)
  typeKey!: OrganizationTypeKey;

  @IsOptional()
  @IsEnum(OrganizationMembershipPolicy)
  membershipPolicy?: OrganizationMembershipPolicy;
}

class CreatePostDto {
  @IsString()
  @MinLength(1)
  body!: string;

  @IsOptional()
  @IsString()
  kind?: string;

  @IsOptional()
  @IsString()
  visibility?: string;
}

class CreateEventDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get('organization-types')
  types() {
    return this.organizations.types();
  }

  @Get('organizations')
  list(@CurrentActor() actor: Actor, @Query('type') type?: string) {
    return this.organizations.list(actor.personId, type);
  }

  @Post('organizations')
  create(@CurrentActor() actor: Actor, @Body() body: CreateOrganizationDto) {
    return this.organizations.create(actor.personId, body);
  }

  @Get('organizations/:id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.get(actor.personId, id);
  }

  @Post('organizations/:id/submit')
  submit(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.submit(actor.personId, id);
  }

  @Post('organizations/:id/approve')
  approve(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    return this.organizations.approve(actor.personId, id, body.reason);
  }

  @Post('organizations/:id/suspend')
  suspend(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.suspend(actor.personId, id);
  }

  @Post('organizations/:id/close')
  close(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.close(actor.personId, id);
  }

  @Post('organizations/:id/archive')
  archive(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.archive(actor.personId, id);
  }

  @Post('organizations/:id/follow')
  follow(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.follow(actor.personId, id);
  }

  @Delete('organizations/:id/follow')
  unfollow(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.unfollow(actor.personId, id);
  }

  @Post('organizations/:id/join')
  join(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.join(actor.personId, id);
  }

  @Post('organizations/:id/leave')
  leave(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.leave(actor.personId, id);
  }

  @Get('organizations/:id/members')
  members(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.members(actor.personId, id);
  }

  @Post('organizations/:id/members/:membershipId/approve')
  approveMember(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.organizations.approveMember(actor.personId, id, membershipId);
  }

  @Post('organizations/:id/members/:membershipId/reject')
  rejectMember(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Param('membershipId') membershipId: string,
  ) {
    return this.organizations.rejectMember(actor.personId, id, membershipId);
  }

  @Post('organizations/:id/transfer-admin')
  transfer(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: { membershipId: string },
  ) {
    return this.organizations.transferAdmin(actor.personId, id, body.membershipId);
  }

  @Get('organizations/:id/posts')
  async posts(@CurrentActor() actor: Actor, @Param('id') id: string) {
    const detail = await this.organizations.get(actor.personId, id);
    return { items: detail.posts };
  }

  @Post('organizations/:id/posts')
  createPost(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreatePostDto,
  ) {
    return this.organizations.createPost(actor.personId, id, body);
  }

  @Get('organization-posts/:postId')
  getPost(@CurrentActor() actor: Actor, @Param('postId') postId: string) {
    return this.organizations.getPost(actor.personId, postId);
  }

  @Post('organization-posts/:postId/archive')
  archivePost(@CurrentActor() actor: Actor, @Param('postId') postId: string) {
    return this.organizations.archivePost(actor.personId, postId);
  }

  @Post('organization-posts/:postId/report')
  reportPost(
    @CurrentActor() actor: Actor,
    @Param('postId') postId: string,
    @Body() body: { reason: ReportReason; details?: string },
  ) {
    return this.organizations.reportPost(actor.personId, postId, body.reason, body.details);
  }

  @Post('organizations/:id/events')
  createEvent(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: CreateEventDto,
  ) {
    return this.organizations.createEvent(actor.personId, id, body);
  }

  @Patch('events/:eventId')
  updateEvent(
    @CurrentActor() actor: Actor,
    @Param('eventId') eventId: string,
    @Body() body: { location?: string; startsAt?: string; title?: string },
  ) {
    return this.organizations.updateEvent(actor.personId, eventId, body);
  }

  @Post('organizations/:id/invitations')
  invite(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: { personId: string },
  ) {
    return this.organizations.invite(actor.personId, id, body.personId);
  }

  @Get('organizations/:id/conversation')
  conversation(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.conversation(actor.personId, id);
  }

  @Get('organizations/:id/notification-settings')
  settings(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.organizations.notificationSettings(actor.personId, id);
  }

  @Patch('organizations/:id/notification-settings')
  updateSettings(
    @CurrentActor() actor: Actor,
    @Param('id') id: string,
    @Body() body: { posts?: string; events?: string; announcements?: string; messages?: string },
  ) {
    return this.organizations.updateNotificationSettings(actor.personId, id, body);
  }
}
