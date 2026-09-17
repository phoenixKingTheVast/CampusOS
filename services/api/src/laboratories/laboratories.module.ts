import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LaboratoriesController } from './laboratories.controller';
import { LaboratoriesService } from './laboratories.service';

@Module({
  imports: [AuthModule],
  controllers: [LaboratoriesController],
  providers: [LaboratoriesService],
})
export class LaboratoriesModule {}
