import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { ProvidersController } from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [AuthModule, MessagingModule],
  // ProvidersController is registered first so `service-providers/me/...` is
  // matched before the public `service-providers/:providerId` route.
  controllers: [ProvidersController, CatalogController, BookingsController],
  providers: [CatalogService, BookingsService, ProvidersService],
  exports: [CatalogService, BookingsService],
})
export class CampusServicesModule {}
