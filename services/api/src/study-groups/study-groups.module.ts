import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudyGroupsController } from './study-groups.controller';
import { StudyGroupsService } from './study-groups.service';

@Module({
  imports: [AuthModule],
  controllers: [StudyGroupsController],
  providers: [StudyGroupsService],
})
export class StudyGroupsModule {}
