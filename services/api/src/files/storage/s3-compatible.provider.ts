import { SignedUrlOptions, StorageProvider, StoredObjectMetadata } from './storage-provider';

export type S3CompatibleConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  publicBaseUrl?: string;
};

const S3_MODULE = '@aws-sdk/client-s3';
const PRESIGNER_MODULE = '@aws-sdk/s3-request-presigner';

async function loadS3(): Promise<any> {
  return import(S3_MODULE);
}

async function loadPresigner(): Promise<any> {
  return import(PRESIGNER_MODULE);
}

/**
 * Shared implementation for the two S3-compatible backends CampusOS targets:
 * Cloudflare R2 in production and MinIO in development. The SDK client is
 * resolved lazily so environments without the dependency installed can still
 * boot on the local provider.
 */
export abstract class S3CompatibleStorageProvider implements StorageProvider {
  abstract readonly name: string;

  private client: any;

  protected constructor(protected readonly config: S3CompatibleConfig) {}

  private async sdk() {
    if (!this.client) {
      const { S3Client } = await loadS3();
      this.client = new S3Client({
        endpoint: this.config.endpoint,
        region: this.config.region,
        forcePathStyle: this.config.forcePathStyle,
        credentials: {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
        },
      });
    }
    return this.client;
  }

  async upload(key: string, body: Buffer, options: { mimeType: string }): Promise<void> {
    const { PutObjectCommand } = await loadS3();
    const client = await this.sdk();
    await client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: options.mimeType,
      }),
    );
  }

  async download(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await loadS3();
    const client = await this.sdk();
    const result = await client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    const chunks: Buffer[] = [];
    for await (const chunk of result.Body as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const { DeleteObjectCommand } = await loadS3();
    const client = await this.sdk();
    await client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  async createSignedUrl(key: string, options: SignedUrlOptions): Promise<{ url: string; expiresAt: Date }> {
    const { GetObjectCommand } = await loadS3();
    const { getSignedUrl } = await loadPresigner();
    const client = await this.sdk();
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ResponseContentDisposition: options.download
        ? `attachment; filename="${options.downloadFilename ?? 'download'}"`
        : undefined,
    });
    const url = await getSignedUrl(client, command, { expiresIn: options.expiresInSeconds });
    return { url, expiresAt: new Date(Date.now() + options.expiresInSeconds * 1000) };
  }

  async exists(key: string): Promise<boolean> {
    return (await this.getMetadata(key)) !== null;
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata | null> {
    const { HeadObjectCommand } = await loadS3();
    const client = await this.sdk();
    try {
      const result = await client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return {
        storageKey: key,
        sizeBytes: Number(result.ContentLength ?? 0),
        mimeType: result.ContentType ?? null,
        checksum: result.ChecksumSHA256 ?? null,
        updatedAt: result.LastModified ?? new Date(),
      };
    } catch {
      return null;
    }
  }
}

export class R2StorageProvider extends S3CompatibleStorageProvider {
  readonly name = 'r2';

  constructor(config: Omit<S3CompatibleConfig, 'forcePathStyle'>) {
    super({ ...config, forcePathStyle: false });
  }
}

export class MinioStorageProvider extends S3CompatibleStorageProvider {
  readonly name = 'minio';

  constructor(config: Omit<S3CompatibleConfig, 'forcePathStyle' | 'region'> & { region?: string }) {
    super({ ...config, region: config.region ?? 'us-east-1', forcePathStyle: true });
  }
}
