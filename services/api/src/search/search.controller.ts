import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { SearchService } from './search.service';

@Controller('search')
@UseGuards(AuthGuard)
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Get()
  searchQuery(
    @CurrentActor() actor: Actor,
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = Number(limit);
    return this.search.search(
      actor.personId,
      q ?? '',
      type ?? 'all',
      Number.isFinite(parsed) ? Math.min(50, Math.max(1, parsed)) : 24,
    );
  }

  @Get('recent')
  recent(@CurrentActor() actor: Actor) {
    return this.search.recent(actor.personId);
  }
}
