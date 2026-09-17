import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { NotificationsService } from './notifications.service';

class BatchReadDto {
  @IsArray()
  @IsString({ each: true })
  notificationIds!: string[];
}

class PreferenceDto {
  @IsOptional()
  @IsBoolean()
  directMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  mentions?: boolean;

  @IsOptional()
  @IsBoolean()
  groupMessages?: boolean;

  @IsOptional()
  @IsBoolean()
  academicImportant?: boolean;

  @IsOptional()
  @IsBoolean()
  assignments?: boolean;

  @IsOptional()
  @IsBoolean()
  resources?: boolean;

  @IsOptional()
  @IsBoolean()
  classUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  organizationEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  organizationPosts?: boolean;

  @IsOptional()
  @IsBoolean()
  serviceUpdates?: boolean;

  @IsOptional()
  @IsBoolean()
  follows?: boolean;

  @IsOptional()
  @IsString()
  quietHoursStart?: string | null;

  @IsOptional()
  @IsString()
  quietHoursEnd?: string | null;
}

class DeviceDto {
  @IsString()
  platform!: string;

  @IsOptional()
  @IsString()
  pushToken?: string;

  @IsOptional()
  @IsString()
  appVersion?: string;

  @IsOptional()
  @IsBoolean()
  notificationEnabled?: boolean;
}

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get('notifications')
  list(
    @CurrentActor() actor: Actor,
    @Query('category') category?: string,
    @Query('unread') unread?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.notifications.list(actor.personId, { category, unread, cursor });
  }

  @Get('notifications/unread-count')
  unreadCount(@CurrentActor() actor: Actor) {
    return this.notifications.unreadCount(actor.personId);
  }

  @Post('notifications/read')
  markMany(@CurrentActor() actor: Actor, @Body() body: BatchReadDto) {
    return this.notifications.markMany(actor.personId, body.notificationIds ?? []);
  }

  @Post('notifications/read-all')
  markAll(@CurrentActor() actor: Actor) {
    return this.notifications.markAll(actor.personId);
  }

  @Post('notifications/:id/read')
  markRead(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.notifications.markRead(actor.personId, id);
  }

  @Get('notifications/:id/open')
  open(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.notifications.open(actor.personId, id);
  }

  @Get('notification-preferences')
  preferences(@CurrentActor() actor: Actor) {
    return this.notifications.preferences(actor.personId);
  }

  @Patch('notification-preferences')
  updatePreferences(@CurrentActor() actor: Actor, @Body() body: PreferenceDto) {
    return this.notifications.updatePreferences(actor.personId, body);
  }

  @Post('devices')
  registerDevice(@CurrentActor() actor: Actor, @Body() body: DeviceDto) {
    return this.notifications.registerDevice(actor.personId, body);
  }

  @Patch('devices/:deviceId')
  updateDevice(@CurrentActor() actor: Actor, @Param('deviceId') deviceId: string, @Body() body: DeviceDto) {
    return this.notifications.updateDevice(actor.personId, deviceId, body);
  }

  @Delete('devices/:deviceId')
  revokeDevice(@CurrentActor() actor: Actor, @Param('deviceId') deviceId: string) {
    return this.notifications.revokeDevice(actor.personId, deviceId);
  }
}
