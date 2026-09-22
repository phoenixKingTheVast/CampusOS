import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { DiscussionsService } from './discussions.service';

class CreateDiscussionDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(1)
  body!: string;
}

class ReplyDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

@Controller()
@UseGuards(AuthGuard)
export class DiscussionsController {
  constructor(private readonly discussions: DiscussionsService) {}

  @Get('course-offerings/:courseOfferingId/discussions')
  list(@CurrentActor() actor: Actor, @Param('courseOfferingId') courseOfferingId: string) {
    return this.discussions.list(actor.personId, courseOfferingId);
  }

  @Post('course-offerings/:courseOfferingId/discussions')
  create(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Body() body: CreateDiscussionDto,
  ) {
    return this.discussions.create(actor.personId, courseOfferingId, body);
  }

  @Get('discussions/:discussionId')
  get(@CurrentActor() actor: Actor, @Param('discussionId') discussionId: string) {
    return this.discussions.get(actor.personId, discussionId);
  }

  @Post('discussions/:discussionId/replies')
  reply(
    @CurrentActor() actor: Actor,
    @Param('discussionId') discussionId: string,
    @Body() body: ReplyDto,
  ) {
    return this.discussions.reply(actor.personId, discussionId, body.body);
  }
}
