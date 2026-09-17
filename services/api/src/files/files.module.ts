import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { FILE_SCANNER } from './file-scanner';
import { DefaultFileScanner } from './file-scanner';
import { storageProviderFactory } from './storage/storage.factory';

@Module({
  imports: [AuthModule],
  controllers: [FilesController],
  providers: [
    FilesService,
    storageProviderFactory,
    { provide: FILE_SCANNER, useClass: DefaultFileScanner },
  ],
  exports: [FilesService],
})
export class FilesModule {}
