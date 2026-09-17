import { ConfigService } from '@nestjs/config';
import { LocalStorageProvider } from './local-storage.provider';
import { MinioStorageProvider, R2StorageProvider } from './s3-compatible.provider';
import { STORAGE_PROVIDER, StorageProvider } from './storage-provider';

export function createStorageProvider(config: ConfigService): StorageProvider {
  const driver = config.get<string>('STORAGE_DRIVER', 'local');
  const bucket = config.get<string>('STORAGE_BUCKET', 'campusos');
  const accessKeyId = config.get<string>('STORAGE_ACCESS_KEY_ID', '');
  const secretAccessKey = config.get<string>('STORAGE_SECRET_ACCESS_KEY', '');
  const endpoint = config.get<string>('STORAGE_ENDPOINT', '');

  if (driver === 'r2' && endpoint && accessKeyId && secretAccessKey) {
    return new R2StorageProvider({
      endpoint,
      region: config.get<string>('STORAGE_REGION', 'auto'),
      bucket,
      accessKeyId,
      secretAccessKey,
    });
  }

  if (driver === 'minio' && endpoint && accessKeyId && secretAccessKey) {
    return new MinioStorageProvider({
      endpoint,
      region: config.get<string>('STORAGE_REGION', 'us-east-1'),
      bucket,
      accessKeyId,
      secretAccessKey,
    });
  }

  return new LocalStorageProvider(config);
}

export const storageProviderFactory = {
  provide: STORAGE_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService) => createStorageProvider(config),
};
