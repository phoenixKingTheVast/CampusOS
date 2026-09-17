import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { HomeService } from './home.service';

@Controller('home')
@UseGuards(AuthGuard)
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  getHome(
    @CurrentActor() actor: Actor,
    @Query('timezone') timezone?: string,
    @Query('date') date?: string,
  ) {
    return this.home.getHome(actor.personId, timezone ?? 'Africa/Harare', date);
  }
}
