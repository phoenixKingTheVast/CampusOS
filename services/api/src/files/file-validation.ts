import { UploadContext, validateUpload } from './file-policy';

export type DetectedFileType = {
  mimeType: string;
  extension: string;
};

const JPEG = { mimeType: 'image/jpeg', extension: 'jpg' };
const PNG = { mimeType: 'image/png', extension: 'png' };
const PDF = { mimeType: 'application/pdf', extension: 'pdf' };
const WEBP = { mimeType: 'image/webp', extension: 'webp' };
const ZIP = { mimeType: 'application/zip', extension: 'zip' };
const MP4 = { mimeType: 'video/mp4', extension: 'mp4' };

const ALLOWED_TYPES: DetectedFileType[] = [JPEG, PNG, PDF, WEBP, ZIP, MP4];

export function sanitizeFilename(original: string): string {
  const replaced = original.replace(/\\/g, '/');
  const base = replaced.split('/').pop() ?? 'upload';
  const cleaned = base.replace(/[^\w.\- ()]/g, '_').replace(/^\.+/g, '').trim();
  if (!cleaned || cleaned === '.' || cleaned === '..') {
    return 'upload';
  }
  return cleaned.slice(0, 180);
}

export function extensionOf(filename: string): string {
  const base = sanitizeFilename(filename);
  const index = base.lastIndexOf('.');
  if (index <= 0 || index === base.length - 1) {
    return '';
  }
  return base.slice(index + 1).toLowerCase();
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false;
  return bytes.every((value, index) => buffer[index] === value);
}

export function detectTypeFromSignature(buffer: Buffer): DetectedFileType | null {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return JPEG;
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return PNG;
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return PDF;
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return WEBP;
  }
  if (startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) || startsWith(buffer, [0x50, 0x4b, 0x05, 0x06])) {
    return ZIP;
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') {
    return MP4;
  }
  return null;
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
  webp: 'image/webp',
  zip: 'application/zip',
  docx: 'application/zip',
  mp4: 'video/mp4',
};

export function validateStoredBytes(input: {
  context: UploadContext;
  originalFilename: string;
  declaredMimeType: string;
  buffer: Buffer;
}): { valid: true; mimeType: string; displayName: string; extension: string } | { valid: false; reason: string } {
  const displayName = sanitizeFilename(input.originalFilename);
  if (displayName.includes('..') || input.originalFilename.includes('\0')) {
    return { valid: false, reason: 'That filename is not allowed.' };
  }

  const quota = validateUpload({
    context: input.context,
    sizeBytes: input.buffer.length,
    mimeType: input.declaredMimeType,
  });
  if (!quota.valid) {
    return { valid: false, reason: quota.reason ?? "That file isn't supported here." };
  }

  const detected = detectTypeFromSignature(input.buffer);
  if (!detected) {
    return { valid: false, reason: "That file type isn't supported here." };
  }
  if (!ALLOWED_TYPES.some((item) => item.mimeType === detected.mimeType)) {
    return { valid: false, reason: "That file type isn't supported here." };
  }

  const declared = input.declaredMimeType.toLowerCase();
  const declaredIsZipFamily = declared === 'application/zip' || declared === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const detectedMatchesDeclared =
    detected.mimeType === declared ||
    (detected.mimeType === 'application/zip' && declaredIsZipFamily);
  if (!detectedMatchesDeclared) {
    return { valid: false, reason: "That file doesn't match the type it claimed to be." };
  }

  const extension = extensionOf(displayName);
  if (extension) {
    const expectedMime = EXTENSION_MIME[extension];
    if (!expectedMime) {
      return { valid: false, reason: "That file type isn't supported here." };
    }
    if (expectedMime !== detected.mimeType) {
      return { valid: false, reason: "That file's name doesn't match its contents." };
    }
  }

  const typedQuota = validateUpload({
    context: input.context,
    sizeBytes: input.buffer.length,
    mimeType: detected.mimeType,
  });
  if (!typedQuota.valid) {
    return { valid: false, reason: typedQuota.reason ?? "That file type isn't supported here." };
  }

  return {
    valid: true,
    mimeType: detected.mimeType,
    displayName,
    extension: detected.extension,
  };
}
