import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccessService } from '../common/access.service';
import { AcademicController } from './academic.controller';
import { AcademicService } from './academic.service';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [AcademicController],
  providers: [AcademicService, AccessService],
  exports: [AcademicService, AccessService],
})
export class AcademicModule {}
