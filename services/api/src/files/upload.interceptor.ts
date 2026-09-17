import { memoryStorage } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';

export const uploadInterceptor = FileInterceptor('file', {
  storage: memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});
