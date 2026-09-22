import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DiscussionsController } from './discussions.controller';
import { DiscussionsService } from './discussions.service';

@Module({
  imports: [AuthModule],
  controllers: [DiscussionsController],
  providers: [DiscussionsService],
})
export class DiscussionsModule {}
