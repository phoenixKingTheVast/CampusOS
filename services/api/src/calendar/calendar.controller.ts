import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { CalendarService } from './calendar.service';

class PersonalActivityDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsString()
  startTime!: string;

  @IsOptional()
  @IsString()
  endTime?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  reminderOffsetMinutes?: number;
}

@Controller()
@UseGuards(AuthGuard)
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('calendar')
  range(
    @CurrentActor() actor: Actor,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('timezone') timezone?: string,
  ) {
    const from = start ?? new Date().toISOString();
    const to = end ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return this.calendar.range(actor.personId, from, to, timezone ?? 'Africa/Harare');
  }

  @Get('activities')
  activities(
    @CurrentActor() actor: Actor,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.calendar.range(actor.personId, start, end);
  }

  @Get('activities/:activityId')
  getActivity(@CurrentActor() actor: Actor, @Param('activityId') activityId: string) {
    return this.calendar.getActivity(actor.personId, activityId);
  }

  @Post('activities')
  create(@CurrentActor() actor: Actor, @Body() body: PersonalActivityDto) {
    return this.calendar.createPersonal(actor.personId, body);
  }

  @Patch('activities/:activityId')
  update(
    @CurrentActor() actor: Actor,
    @Param('activityId') activityId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.calendar.updatePersonal(actor.personId, activityId, body);
  }

  @Post('activities/:activityId/cancel')
  cancel(@CurrentActor() actor: Actor, @Param('activityId') activityId: string) {
    return this.calendar.cancelPersonal(actor.personId, activityId);
  }

  @Post('activities/:activityId/reminders')
  remind(
    @CurrentActor() actor: Actor,
    @Param('activityId') activityId: string,
    @Body() body: { offsetMinutes: number },
  ) {
    return this.calendar.setReminder(actor.personId, activityId, body.offsetMinutes);
  }
}
