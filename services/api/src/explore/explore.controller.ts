import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { ExploreService } from './explore.service';

@Controller('explore')
@UseGuards(AuthGuard)
export class ExploreController {
  constructor(private readonly explore: ExploreService) {}

  @Get()
  getExplore(@CurrentActor() actor: Actor) {
    return this.explore.getExplore(actor.personId);
  }
}
