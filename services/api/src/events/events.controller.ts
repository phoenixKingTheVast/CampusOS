import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { EventsService } from './events.service';

class CreateEventDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsString()
  organizerType!: string;

  @IsOptional()
  @IsString()
  organizerId?: string;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  startsAt!: string;

  @IsOptional()
  @IsString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  visibility?: string;

  @IsOptional()
  @IsString()
  participationPolicy?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  capacity?: number;

  @IsOptional()
  @IsBoolean()
  registrationRequired?: boolean;

  @IsOptional()
  @IsString()
  externalRegistrationUrl?: string;

  @IsOptional()
  @IsBoolean()
  publish?: boolean;
}

class RespondDto {
  @IsString()
  response!: string;
}

@Controller('events')
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  list(
    @CurrentActor() actor: Actor,
    @Query('type') type?: string,
    @Query('upcoming') upcoming?: string,
  ) {
    return this.events.list(actor.personId, { type, upcoming });
  }

  @Post()
  create(@CurrentActor() actor: Actor, @Body() body: CreateEventDto) {
    return this.events.create(actor.personId, body);
  }

  @Get(':eventId')
  get(@CurrentActor() actor: Actor, @Param('eventId') eventId: string) {
    return this.events.get(actor.personId, eventId);
  }

  @Post(':eventId/publish')
  publish(@CurrentActor() actor: Actor, @Param('eventId') eventId: string) {
    return this.events.publish(actor.personId, eventId);
  }

  @Post(':eventId/reschedule')
  reschedule(
    @CurrentActor() actor: Actor,
    @Param('eventId') eventId: string,
    @Body() body: { startsAt: string; endsAt?: string; location?: string; expectedVersion?: number },
  ) {
    return this.events.reschedule(actor.personId, eventId, body);
  }

  @Post(':eventId/cancel')
  cancel(
    @CurrentActor() actor: Actor,
    @Param('eventId') eventId: string,
    @Body() body: { reason?: string },
  ) {
    return this.events.cancel(actor.personId, eventId, body.reason);
  }

  @Get(':eventId/responses')
  responses(@CurrentActor() actor: Actor, @Param('eventId') eventId: string) {
    return this.events.responses(actor.personId, eventId);
  }

  @Post(':eventId/responses')
  respond(
    @CurrentActor() actor: Actor,
    @Param('eventId') eventId: string,
    @Body() body: RespondDto,
  ) {
    return this.events.respond(actor.personId, eventId, body.response);
  }

  @Patch(':eventId/responses')
  updateResponse(
    @CurrentActor() actor: Actor,
    @Param('eventId') eventId: string,
    @Body() body: RespondDto,
  ) {
    return this.events.respond(actor.personId, eventId, body.response);
  }

  @Delete(':eventId/responses')
  clearResponse(@CurrentActor() actor: Actor, @Param('eventId') eventId: string) {
    return this.events.respond(actor.personId, eventId, 'NONE');
  }

  @Post(':eventId/report')
  report(
    @CurrentActor() actor: Actor,
    @Param('eventId') eventId: string,
    @Body() body: { reason: string; details?: string },
  ) {
    return this.events.report(actor.personId, eventId, body.reason, body.details);
  }
}
