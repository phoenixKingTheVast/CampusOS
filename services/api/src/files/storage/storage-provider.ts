export type StoredObjectMetadata = {
  storageKey: string;
  sizeBytes: number;
  mimeType: string | null;
  checksum: string | null;
  updatedAt: Date;
};

export type SignedUrlOptions = {
  expiresInSeconds: number;
  download?: boolean;
  downloadFilename?: string;
};

export interface StorageProvider {
  readonly name: string;
  upload(key: string, body: Buffer, options: { mimeType: string }): Promise<void>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  createSignedUrl(key: string, options: SignedUrlOptions): Promise<{ url: string; expiresAt: Date }>;
  exists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<StoredObjectMetadata | null>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');

export function storageKeyFor(input: { fileId: string; securityClass: string; extension?: string }): string {
  const prefix = input.securityClass.toLowerCase();
  const suffix = input.extension ? `.${input.extension.replace(/^\./, '')}` : '';
  return `${prefix}/${input.fileId}${suffix}`;
}

export function derivativeKeyFor(sourceKey: string, variant: 'thumbnail' | 'preview' | 'optimized'): string {
  return `derivatives/${variant}/${sourceKey}`;
}
