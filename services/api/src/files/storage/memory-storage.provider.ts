import { createHash } from 'crypto';
import { generateToken } from '../../common/crypto';
import { SignedUrlOptions, StorageProvider, StoredObjectMetadata } from './storage-provider';

type Grant = { key: string; expiresAt: number };

export class MemoryStorageProvider implements StorageProvider {
  readonly name = 'memory';
  private readonly objects = new Map<string, { body: Buffer; mimeType: string; updatedAt: Date }>();
  private readonly grants = new Map<string, Grant>();

  async upload(key: string, body: Buffer, options: { mimeType: string }): Promise<void> {
    this.objects.set(key, { body: Buffer.from(body), mimeType: options.mimeType, updatedAt: new Date() });
  }

  async download(key: string): Promise<Buffer> {
    const stored = this.objects.get(key);
    if (!stored) {
      throw new Error('missing');
    }
    return Buffer.from(stored.body);
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }

  async createSignedUrl(key: string, options: SignedUrlOptions): Promise<{ url: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    this.grants.set(token, { key, expiresAt: expiresAt.getTime() });
    return { url: `/api/v1/files/stream?token=${token}`, expiresAt };
  }

  async exists(key: string): Promise<boolean> {
    return this.objects.has(key);
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata | null> {
    const stored = this.objects.get(key);
    if (!stored) return null;
    return {
      storageKey: key,
      sizeBytes: stored.body.length,
      mimeType: stored.mimeType,
      checksum: createHash('sha256').update(stored.body).digest('hex'),
      updatedAt: stored.updatedAt,
    };
  }

  resolveGrant(token: string): string | null {
    const grant = this.grants.get(token);
    if (!grant || grant.expiresAt < Date.now()) {
      this.grants.delete(token);
      return null;
    }
    return grant.key;
  }

  storedKeys(): string[] {
    return [...this.objects.keys()];
  }
}
