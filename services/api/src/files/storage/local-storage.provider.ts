import { createHash } from 'crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateToken } from '../../common/crypto';
import { SignedUrlOptions, StorageProvider, StoredObjectMetadata } from './storage-provider';

type Grant = { key: string; expiresAt: number };

const grants = new Map<string, Grant>();

/**
 * Filesystem-backed provider used when MinIO/R2 credentials are absent, so the
 * API boots on a clean checkout. Signed URLs are short-lived tokens redeemed by
 * the file controller rather than direct filesystem paths.
 */
@Injectable()
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local';

  private readonly root: string;

  constructor(private readonly config: ConfigService) {
    this.root = resolve(this.config.get('FILE_STORAGE_DIR', './uploads'));
  }

  private path(key: string): string {
    return join(this.root, key);
  }

  async upload(key: string, body: Buffer, _options: { mimeType: string }): Promise<void> {
    const target = this.path(key);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.path(key));
  }

  async delete(key: string): Promise<void> {
    await rm(this.path(key), { force: true });
  }

  async createSignedUrl(key: string, options: SignedUrlOptions): Promise<{ url: string; expiresAt: Date }> {
    const token = generateToken();
    const expiresAt = new Date(Date.now() + options.expiresInSeconds * 1000);
    grants.set(token, { key, expiresAt: expiresAt.getTime() });
    return { url: `/api/v1/files/stream?token=${token}`, expiresAt };
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.path(key));
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(key: string): Promise<StoredObjectMetadata | null> {
    try {
      const info = await stat(this.path(key));
      const bytes = await readFile(this.path(key));
      return {
        storageKey: key,
        sizeBytes: info.size,
        mimeType: null,
        checksum: createHash('sha256').update(bytes).digest('hex'),
        updatedAt: info.mtime,
      };
    } catch {
      return null;
    }
  }

  resolveGrant(token: string): string | null {
    const grant = grants.get(token);
    if (!grant || grant.expiresAt < Date.now()) {
      grants.delete(token);
      return null;
    }
    return grant.key;
  }
}
