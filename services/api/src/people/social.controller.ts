import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { SocialService } from './social.service';

class UpdatePrivacySettingsDto {
  @IsOptional()
  @IsString()
  profileVisibility?: string;

  @IsOptional()
  @IsBoolean()
  findable?: boolean;

  @IsOptional()
  @IsString()
  whoCanFollow?: string;

  @IsOptional()
  @IsString()
  whoCanConnect?: string;

  @IsOptional()
  @IsString()
  whoCanMessage?: string;

  @IsOptional()
  @IsString()
  activityVisibility?: string;

  @IsOptional()
  @IsString()
  followerVisibility?: string;

  @IsOptional()
  @IsString()
  followingVisibility?: string;

  @IsOptional()
  @IsString()
  connectionVisibility?: string;
}

class ReportPersonDto {
  // Free text rather than @IsEnum: the service coerces an unrecognized reason
  // to OTHER instead of rejecting the report.
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Get('privacy-settings')
  privacySettings(@CurrentActor() actor: Actor) {
    return this.social.privacySettings(actor.personId);
  }

  @Patch('privacy-settings')
  updatePrivacySettings(@CurrentActor() actor: Actor, @Body() body: UpdatePrivacySettingsDto) {
    return this.social.updatePrivacySettings(actor.personId, body);
  }

  @Get('people/blocked')
  blocked(@CurrentActor() actor: Actor, @Query('cursor') cursor?: string) {
    return this.social.blockedPeople(actor.personId, cursor);
  }

  @Get('people/me/connection-requests')
  connectionRequests(@CurrentActor() actor: Actor, @Query('cursor') cursor?: string) {
    return this.social.incomingConnectionRequests(actor.personId, cursor);
  }

  @Post('people/:personId/follow')
  follow(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.follow(actor.personId, personId);
  }

  @Delete('people/:personId/follow')
  unfollow(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.unfollow(actor.personId, personId);
  }

  @Get('people/:personId/followers')
  followers(
    @CurrentActor() actor: Actor,
    @Param('personId') personId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.social.followers(actor.personId, personId, cursor);
  }

  @Get('people/:personId/following')
  following(
    @CurrentActor() actor: Actor,
    @Param('personId') personId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.social.following(actor.personId, personId, cursor);
  }

  @Post('people/:personId/connect')
  connect(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.requestConnection(actor.personId, personId);
  }

  @Post('people/:personId/connect/accept')
  acceptConnection(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.acceptConnection(actor.personId, personId);
  }

  @Post('people/:personId/connect/decline')
  declineConnection(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.declineConnection(actor.personId, personId);
  }

  @Delete('people/:personId/connect')
  withdrawConnection(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.withdrawConnection(actor.personId, personId);
  }

  @Get('people/:personId/connections')
  connections(
    @CurrentActor() actor: Actor,
    @Param('personId') personId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.social.connections(actor.personId, personId, cursor);
  }

  @Post('people/:personId/block')
  block(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.block(actor.personId, personId);
  }

  @Delete('people/:personId/block')
  unblock(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.social.unblock(actor.personId, personId);
  }

  @Post('people/:personId/report')
  report(
    @CurrentActor() actor: Actor,
    @Param('personId') personId: string,
    @Body() body: ReportPersonDto,
  ) {
    return this.social.report(actor.personId, personId, body);
  }
}
