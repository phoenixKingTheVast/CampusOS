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
import { IsArray, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { MessagingService } from './messaging.service';

class DirectConversationDto {
  @IsString()
  personId!: string;
}

class SendMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  body?: string;

  @IsOptional()
  @IsString()
  messageType?: string;

  @IsOptional()
  @IsString()
  replyToMessageId?: string;

  @IsOptional()
  @IsString()
  clientActionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mentionPersonIds?: string[];

  @IsOptional()
  @IsString()
  sharedObjectType?: string;

  @IsOptional()
  @IsString()
  sharedObjectId?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;
}

class EditMessageDto {
  @IsString()
  @MaxLength(4000)
  body!: string;
}

class ReactionDto {
  @IsString()
  @MaxLength(16)
  reaction!: string;
}

class ReportMessageDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

class MessagePageDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

@Controller()
@UseGuards(AuthGuard)
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('conversations')
  inbox(@CurrentActor() actor: Actor, @Query('cursor') cursor?: string) {
    return this.messaging.inbox(actor.personId, cursor);
  }

  @Post('conversations/direct')
  direct(@CurrentActor() actor: Actor, @Body() body: DirectConversationDto) {
    return this.messaging.findOrCreateDirect(actor.personId, body.personId);
  }

  @Get('conversations/:id')
  get(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.get(actor.personId, id);
  }

  @Get('conversations/:id/messages')
  messages(@CurrentActor() actor: Actor, @Param('id') id: string, @Query() query: MessagePageDto) {
    return this.messaging.messages(actor.personId, id, query.cursor, query.limit);
  }

  @Post('conversations/:id/messages')
  send(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: SendMessageDto) {
    return this.messaging.sendMessage(actor.personId, id, body);
  }

  @Post('conversations/:id/read')
  read(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.markRead(actor.personId, id);
  }

  @Post('conversations/:id/mute')
  mute(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.mute(actor.personId, id);
  }

  @Post('conversations/:id/unmute')
  unmute(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.unmute(actor.personId, id);
  }

  @Delete('conversations/:id/mute')
  removeMute(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.unmute(actor.personId, id);
  }

  @Post('conversations/:id/leave')
  leave(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.leave(actor.personId, id);
  }

  @Patch('messages/:id')
  edit(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: EditMessageDto) {
    return this.messaging.editMessage(actor.personId, id, body.body);
  }

  @Delete('messages/:id')
  remove(@CurrentActor() actor: Actor, @Param('id') id: string) {
    return this.messaging.removeMessage(actor.personId, id);
  }

  @Post('messages/:id/reactions')
  react(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: ReactionDto) {
    return this.messaging.react(actor.personId, id, body.reaction);
  }

  @Post('messages/:id/report')
  report(@CurrentActor() actor: Actor, @Param('id') id: string, @Body() body: ReportMessageDto) {
    return this.messaging.reportMessage(actor.personId, id, body);
  }
}
