import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [AuthModule],
  // SocialController first: Nest registers routes in this order, and its
  // literal `people/blocked` and `people/me/connection-requests` paths have to
  // be matched before PeopleController's `people/:personId`.
  controllers: [SocialController, PeopleController],
  providers: [PeopleService, SocialService],
  exports: [PeopleService, SocialService],
})
export class PeopleModule {}
