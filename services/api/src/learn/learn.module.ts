import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LearnController } from './learn.controller';
import { LearnService } from './learn.service';

@Module({
  imports: [AuthModule],
  controllers: [LearnController],
  providers: [LearnService],
})
export class LearnModule {}
