import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { LearnService } from './learn.service';

@Controller('learn')
@UseGuards(AuthGuard)
export class LearnController {
  constructor(private readonly learn: LearnService) {}

  @Get()
  getLearn(
    @CurrentActor() actor: Actor,
    @Query('timezone') timezone?: string,
    @Query('date') date?: string,
  ) {
    return this.learn.getLearn(actor.personId, timezone ?? 'Africa/Harare', date);
  }
}
