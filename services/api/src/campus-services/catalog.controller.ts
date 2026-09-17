import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { CatalogService } from './catalog.service';

@Controller()
@UseGuards(AuthGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('service-categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('services')
  list(
    @Query('category') category?: string,
    @Query('q') q?: string,
    @Query('mode') mode?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.catalog.listServices({ category, q, mode, cursor });
  }

  @Get('services/:serviceId')
  get(@CurrentActor() actor: Actor, @Param('serviceId') serviceId: string) {
    return this.catalog.getService(actor.personId, serviceId);
  }

  @Get('services/:serviceId/booking-form')
  bookingForm(@CurrentActor() actor: Actor, @Param('serviceId') serviceId: string) {
    return this.catalog.bookingForm(actor.personId, serviceId);
  }

  @Get('services/:serviceId/availability')
  availability(@Param('serviceId') serviceId: string, @Query('days') days?: string) {
    const parsed = Number(days);
    return this.catalog.availability(
      serviceId,
      Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 30) : 14,
    );
  }

  @Get('services/:serviceId/reviews')
  reviews(@Param('serviceId') serviceId: string, @Query('cursor') cursor?: string) {
    return this.catalog.serviceReviews(serviceId, cursor);
  }

  @Get('service-providers/:providerId')
  provider(@CurrentActor() actor: Actor, @Param('providerId') providerId: string) {
    return this.catalog.getProvider(actor.personId, providerId);
  }
}
