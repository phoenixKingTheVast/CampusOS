import { createHash } from 'crypto';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import {
  FileAction,
  FileLifecycleState,
  UploadContext,
  asLifecycleState,
  asSecurityClass,
  authorizeFileAction,
  canSurfaceInDiscovery,
  canTransitionFile,
  duplicateOutcome,
  offlineCacheAllowed,
  persistProcessingState,
  requiresAccessAudit,
  securityClassFor,
  signedUrlTtlSeconds,
  validateUpload,
} from './file-policy';
import { FILE_SCANNER, FileScanner } from './file-scanner';
import { sanitizeFilename, validateStoredBytes } from './file-validation';
import { STORAGE_PROVIDER, StorageProvider, storageKeyFor } from './storage/storage-provider';
import {
  UploadSessionState,
  chunkCount,
  nextChunkIndex,
  resolveCompletion,
  resumableRequired,
  sessionExpired,
  offlineDisposition,
} from './upload-session';
import { authorizeFeedCandidates } from '../content/feed-query';
import { loadViewerContext } from '../content/viewer-context';
import { PostContextType, PostStatus, PostVisibility } from '../content/content-policy';

type Session = {
  fileId: string;
  personId: string;
  clientActionId: string;
  context: UploadContext;
  contextObjectId?: string;
  state: UploadSessionState;
  receivedChunks: number[];
  totalChunks: number;
  sizeBytes: number;
  declaredMime: string;
  originalFilename: string;
  chunks: Map<number, Buffer>;
  createdAt: Date;
  expectedChecksum?: string;
};

const NEVER_LOGGED = new Set([
  'contents',
  'buffer',
  'accessUrl',
  'signedUrl',
  'storageKey',
  'accessToken',
  'evidenceImage',
]);

@Injectable()
export class FilesService {
  private readonly sessions = new Map<string, Session>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
    @Optional() @Inject(FILE_SCANNER) private readonly scanner?: FileScanner,
  ) {}

  async createUploadSession(
    personId: string,
    input: {
      fileName: string;
      mimeType: string;
      sizeBytes: number;
      context: UploadContext;
      contextObjectId?: string;
      clientActionId?: string;
      checksumSha256?: string;
    },
  ) {
    await this.assertCanUpload(personId, input.context, input.contextObjectId);
    const quota = validateUpload({
      context: input.context,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType,
    });
    if (!quota.valid) {
      throw Errors.validation(quota.reason ?? "That file isn't supported here.");
    }

    const clientActionId = input.clientActionId?.trim() || newId('act');
    const existing = await this.prisma.fileObject.findFirst({
      where: { uploaderId: personId, clientActionId },
    });
    if (existing && asLifecycleState(existing) === 'AVAILABLE') {
      return this.sessionResponse(existing.id, clientActionId, existing);
    }

    const fileId = existing?.id ?? newId('file');
    const securityClass = securityClassFor(input.context);
    const displayName = sanitizeFilename(input.fileName);
    const storageKey = storageKeyFor({ fileId, securityClass });

    const file = existing
      ? await this.prisma.fileObject.update({
          where: { id: fileId },
          data: {
            originalName: displayName,
            displayName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            securityClass,
            uploadContext: input.context,
            lifecycleState: 'UPLOADING',
            processingState: 'UPLOADING',
            storageKey,
          },
        })
      : await this.prisma.fileObject.create({
          data: {
            id: fileId,
            uploaderId: personId,
            originalName: displayName,
            displayName,
            mimeType: input.mimeType,
            sizeBytes: input.sizeBytes,
            storageKey,
            securityClass,
            uploadContext: input.context,
            clientActionId,
            lifecycleState: 'UPLOADING',
            processingState: 'UPLOADING',
          },
        });

    const totalChunks = Math.max(1, chunkCount(input.sizeBytes));
    this.sessions.set(file.id, {
      fileId: file.id,
      personId,
      clientActionId,
      context: input.context,
      contextObjectId: input.contextObjectId,
      state: 'INITIATED',
      receivedChunks: [],
      totalChunks,
      sizeBytes: input.sizeBytes,
      declaredMime: input.mimeType,
      originalFilename: input.fileName,
      chunks: new Map(),
      createdAt: new Date(),
      expectedChecksum: input.checksumSha256,
    });

    return this.sessionResponse(file.id, clientActionId, file);
  }

  async storeContent(personId: string, fileId: string, buffer: Buffer, chunkIndex = 0) {
    const session = this.requireSession(personId, fileId);
    if (sessionExpired(session.createdAt, new Date())) {
      session.state = 'EXPIRED';
      throw Errors.permissionDenied('This upload session has expired.');
    }
    if (buffer.length === 0) {
      throw Errors.validation('That file appears to be empty.');
    }
    const next = nextChunkIndex(session.receivedChunks, session.totalChunks);
    if (session.totalChunks > 1 && next !== null && chunkIndex !== next && !session.receivedChunks.includes(chunkIndex)) {
      if (chunkIndex !== next) {
        throw Errors.validation('Upload the missing part of this file before continuing.');
      }
    }
    const storedSoFar = [...session.chunks.values()].reduce((sum, part) => sum + part.length, 0);
    const nextSize = session.chunks.has(chunkIndex)
      ? storedSoFar - (session.chunks.get(chunkIndex)?.length ?? 0) + buffer.length
      : storedSoFar + buffer.length;
    const quota = validateUpload({
      context: session.context,
      sizeBytes: nextSize,
      mimeType: session.declaredMime,
    });
    if (!quota.valid) {
      throw Errors.validation(quota.reason ?? "That file isn't supported here.");
    }
    session.chunks.set(chunkIndex, buffer);
    if (!session.receivedChunks.includes(chunkIndex)) {
      session.receivedChunks.push(chunkIndex);
    }
    session.state = 'IN_PROGRESS';
    return {
      fileId,
      receivedChunks: [...session.receivedChunks].sort((a, b) => a - b),
      nextChunk: nextChunkIndex(session.receivedChunks, session.totalChunks),
      resumable: resumableRequired(session.sizeBytes),
    };
  }

  async complete(personId: string, fileId: string) {
    const file = await this.prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.uploaderId !== personId) {
      throw Errors.notFound();
    }
    if (asLifecycleState(file) === 'AVAILABLE') {
      return this.publicMetadata(file);
    }

    const session = this.requireSession(personId, fileId);
    session.state = 'COMPLETING';
    const assembled = this.assemble(session);
    const checksum = createHash('sha256').update(assembled).digest('hex');
    const checksumMatches = !session.expectedChecksum || session.expectedChecksum === checksum;
    const outcome = resolveCompletion({
      sessionState: session.state,
      existingFileId: null,
      receivedChunks: session.receivedChunks,
      totalChunks: session.totalChunks,
      checksumMatches,
    });
    if (outcome.kind === 'REJECTED') {
      throw Errors.validation(outcome.reason);
    }

    const validated = validateStoredBytes({
      context: session.context,
      originalFilename: session.originalFilename,
      declaredMimeType: session.declaredMime,
      buffer: assembled,
    });
    if (!validated.valid) {
      await this.fail(file.id, 'UPLOADING');
      throw Errors.validation(validated.reason);
    }

    await this.transition(file.id, 'UPLOADING', 'PROCESSING');

    const scan = await (this.scanner ?? { scan: async () => ({ clean: true }) }).scan(assembled, validated.mimeType);
    if (!scan.clean) {
      await this.transition(file.id, 'PROCESSING', 'FAILED');
      await this.audit({ event: 'file_processing_failed', fileId: file.id, personId, securityClass: file.securityClass });
      throw Errors.validation(scan.reason ?? 'This file did not pass the security check.');
    }

    const securityClass = securityClassFor(session.context);
    const duplicate = await this.prisma.fileObject.findFirst({
      where: {
        checksumSha256: checksum,
        securityClass,
        lifecycleState: 'AVAILABLE',
        NOT: { id: file.id },
      },
    });
    const reuse = duplicateOutcome({
      checksum,
      existing: duplicate
        ? { id: duplicate.id, checksum: duplicate.checksumSha256 ?? checksum, securityClass: asSecurityClass(duplicate.securityClass) }
        : null,
      context: session.context,
    });

    const storageKey = reuse.reuseStorage && duplicate
      ? duplicate.storageKey
      : storageKeyFor({ fileId: file.id, securityClass, extension: validated.extension });

    if (!reuse.reuseStorage) {
      try {
        await this.storage.upload(storageKey, assembled, { mimeType: validated.mimeType });
      } catch {
        await this.transition(file.id, 'PROCESSING', 'FAILED');
        await this.audit({
          event: 'file_processing_failed',
          fileId: file.id,
          personId,
          securityClass: file.securityClass,
        });
        throw Errors.validation('This file could not be processed.');
      }
    }

    const updated = await this.prisma.fileObject.update({
      where: { id: file.id },
      data: {
        storageKey,
        checksumSha256: checksum,
        mimeType: validated.mimeType,
        displayName: validated.displayName,
        originalName: validated.displayName,
        sizeBytes: assembled.length,
        securityClass,
        lifecycleState: 'AVAILABLE',
        processingState: persistProcessingState('AVAILABLE'),
      },
    });
    session.state = 'COMPLETED';
    session.chunks.clear();
    await this.audit({ event: 'file_uploaded', fileId: updated.id, personId, securityClass });
    return this.publicMetadata(updated);
  }

  async get(personId: string, fileId: string) {
    const file = await this.requireAuthorized(personId, fileId, 'VIEW');
    return this.publicMetadata(file);
  }

  async createSignedAccess(
    personId: string,
    fileId: string,
    action: FileAction = 'VIEW',
  ) {
    const file = await this.requireAuthorized(personId, fileId, action);
    const securityClass = asSecurityClass(file.securityClass);
    if (action === 'SAVE_OFFLINE' && !offlineCacheAllowed(securityClass)) {
      throw Errors.permissionDenied("You don't have permission to do that.");
    }
    const signed = await this.storage.createSignedUrl(file.storageKey, {
      expiresInSeconds: signedUrlTtlSeconds(securityClass),
      download: action === 'DOWNLOAD',
      downloadFilename: file.displayName ?? file.originalName,
    });
    const event = action === 'DOWNLOAD' ? 'file_downloaded' : action === 'SHARE' ? 'file_shared' : 'file_accessed';
    await this.audit({ event, fileId: file.id, personId, securityClass, action });
    return {
      fileId: file.id,
      accessUrl: signed.url,
      expiresAt: signed.expiresAt.toISOString(),
    };
  }

  async download(personId: string, fileId: string) {
    const file = await this.requireAuthorized(personId, fileId, 'DOWNLOAD');
    const securityClass = asSecurityClass(file.securityClass);
    await this.audit({ event: 'file_downloaded', fileId: file.id, personId, securityClass, action: 'DOWNLOAD' });
    const body = await this.storage.download(file.storageKey);
    return { file, body };
  }

  async archive(personId: string, fileId: string) {
    const file = await this.prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file || file.uploaderId !== personId) {
      throw Errors.notFound();
    }
    await this.transition(file.id, asLifecycleState(file), 'ARCHIVED');
    await this.audit({ event: 'file_archived', fileId: file.id, personId, securityClass: file.securityClass });
    return { fileId: file.id, lifecycleState: 'ARCHIVED' };
  }

  async restrict(personId: string, fileId: string) {
    const file = await this.prisma.fileObject.findUnique({ where: { id: fileId } });
    if (!file) throw Errors.notFound();
    await this.transition(file.id, asLifecycleState(file), 'RESTRICTED');
    await this.audit({ event: 'file_restricted', fileId: file.id, personId, securityClass: file.securityClass });
    return { fileId: file.id, lifecycleState: 'RESTRICTED' };
  }

  async streamByToken(token: string) {
    const resolve = (this.storage as { resolveGrant?: (value: string) => string | null }).resolveGrant;
    if (!resolve) {
      throw Errors.permissionDenied('This file link has expired.');
    }
    const key = resolve(token);
    if (!key) {
      throw Errors.permissionDenied('This file link has expired.');
    }
    const file = await this.prisma.fileObject.findFirst({ where: { storageKey: key } });
    if (!file || asLifecycleState(file) !== 'AVAILABLE') {
      throw Errors.validation('This content is no longer available to you.');
    }
    return { file, body: await this.storage.download(key) };
  }

  offlineState(input: {
    securityClass: string;
    stillAuthorized: boolean | null;
    lastValidatedAt: Date;
    now: Date;
  }) {
    return offlineDisposition({
      securityClass: asSecurityClass(input.securityClass),
      stillAuthorized: input.stillAuthorized,
      lastValidatedAt: input.lastValidatedAt,
      now: input.now,
    });
  }

  private sessionResponse(fileId: string, clientActionId: string, file: { lifecycleState?: string | null; processingState?: string }) {
    return {
      uploadId: fileId,
      fileId,
      clientActionId,
      uploadUrl: `/api/v1/files/${fileId}/content`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      lifecycleState: asLifecycleState(file),
    };
  }

  private requireSession(personId: string, fileId: string): Session {
    const session = this.sessions.get(fileId);
    if (!session || session.personId !== personId) {
      throw Errors.permissionDenied('This upload session has expired.');
    }
    return session;
  }

  private assemble(session: Session): Buffer {
    const parts: Buffer[] = [];
    for (let index = 0; index < session.totalChunks; index += 1) {
      const part = session.chunks.get(index);
      if (part) parts.push(part);
    }
    return Buffer.concat(parts);
  }

  private async fail(fileId: string, from: FileLifecycleState) {
    if (canTransitionFile(from, 'FAILED')) {
      await this.prisma.fileObject.update({
        where: { id: fileId },
        data: { lifecycleState: 'FAILED', processingState: 'FAILED' },
      });
    }
  }

  private async transition(fileId: string, from: FileLifecycleState, to: FileLifecycleState) {
    if (!canTransitionFile(from, to)) {
      throw Errors.validation('This content is no longer available to you.');
    }
    await this.prisma.fileObject.update({
      where: { id: fileId },
      data: { lifecycleState: to, processingState: persistProcessingState(to) as never, deletedAt: to === 'DELETED' ? new Date() : null },
    });
  }

  private async requireAuthorized(personId: string, fileId: string, action: FileAction) {
    const file = await this.prisma.fileObject.findUnique({
      where: { id: fileId },
      include: {
        versions: { include: { resource: true } },
        postAttachments: { include: { post: true, resource: true } },
      },
    });
    if (!file) {
      throw Errors.notFound();
    }
    const securityClass = asSecurityClass(file.securityClass);
    if (!canSurfaceInDiscovery(securityClass) && action !== 'VIEW' && action !== 'DOWNLOAD') {
      throw Errors.permissionDenied();
    }
    const domainGrants = await this.domainGrants(personId, file);
    const decision = authorizeFileAction({
      securityClass,
      lifecycleState: asLifecycleState(file),
      action,
      domainGrants,
      authenticated: true,
    });
    if (!decision.allowed) {
      throw Errors.permissionDenied(decision.reason);
    }
    if (requiresAccessAudit(securityClass)) {
      await this.audit({ event: 'file_accessed', fileId: file.id, personId, securityClass, action });
    }
    return file;
  }

  private async domainGrants(
    personId: string,
    file: {
      id: string;
      uploaderId: string | null;
      securityClass: string;
      uploadContext: string | null;
      versions: Array<{ resource: { visibility: string; courseOfferingId: string; uploadedById: string; status: string } }>;
      postAttachments: Array<{
        post: {
          id: string;
          authorId: string;
          contextType: string;
          contextId: string | null;
          status: string;
          visibility: string;
          publishedAt: Date | null;
        };
        resource: { visibility: string; courseOfferingId: string; uploadedById: string; status: string } | null;
      }>;
    },
  ): Promise<FileAction[]> {
    const grants = new Set<FileAction>();
    const sensitive = asSecurityClass(file.securityClass) === 'SENSITIVE' || file.uploadContext === 'VERIFICATION_EVIDENCE';
    if (sensitive) {
      const evidence = await this.prisma.studentVerification.findFirst({
        where: { evidenceFileId: file.id },
      }).catch(() => null);
      if (file.uploaderId === personId || evidence?.personId === personId) {
        grants.add('VIEW');
      }
      return [...grants];
    }

    for (const version of file.versions) {
      if (await this.access.canViewResource(personId, version.resource)) {
        grants.add('VIEW');
      }
      if (await this.access.canDownloadResource(personId, version.resource)) {
        grants.add('DOWNLOAD');
        grants.add('SAVE_OFFLINE');
        grants.add('SHARE');
      }
    }

    for (const attachment of file.postAttachments) {
      if (await this.canViewPost(personId, attachment.post)) {
        grants.add('VIEW');
      }
      if (attachment.resource) {
        if (await this.access.canViewResource(personId, attachment.resource)) {
          grants.add('VIEW');
        }
        if (await this.access.canDownloadResource(personId, attachment.resource)) {
          grants.add('DOWNLOAD');
          grants.add('SAVE_OFFLINE');
        }
      }
    }

    if (file.uploaderId === personId && grants.size === 0) {
      grants.add('VIEW');
      grants.add('DOWNLOAD');
      grants.add('SHARE');
      grants.add('SAVE_OFFLINE');
    }

    return [...grants];
  }

  private async canViewPost(
    personId: string,
    post: {
      id: string;
      authorId: string;
      contextType: string;
      contextId: string | null;
      status: string;
      visibility: string;
      publishedAt: Date | null;
    },
  ) {
    const viewer = await loadViewerContext(this.prisma, personId);
    const authorized = authorizeFeedCandidates(
      [
        {
          id: post.id,
          kind: 'POST',
          authorId: post.authorId,
          contextType: post.contextType as PostContextType,
          contextId: post.contextId,
          status: post.status as PostStatus,
          visibility: post.visibility as PostVisibility,
          priority: 'NORMAL',
          publishedAt: post.publishedAt ?? new Date(0),
          reactionCount: 0,
          commentCount: 0,
        },
      ],
      viewer,
    );
    return authorized.length === 1;
  }

  private async assertCanUpload(personId: string, context: UploadContext, contextObjectId?: string) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!person) {
      throw Errors.unauthenticated();
    }
    if (person.accountState === 'SUSPENDED') {
      throw Errors.permissionDenied('Your account cannot post right now.');
    }
    if (context === 'RESOURCE') {
      if (!contextObjectId) {
        throw Errors.permissionDenied("You don't have permission to do that.");
      }
      const course = await this.access.courseContext(personId, contextObjectId);
      if (!course?.can('CREATE_RESOURCE')) {
        throw Errors.permissionDenied();
      }
    }
    if (context === 'ORGANIZATION_MEDIA' && contextObjectId) {
      const membership = await this.prisma.organizationMembership.findUnique({
        where: { organizationId_personId: { organizationId: contextObjectId, personId } },
      });
      if (!membership || membership.status !== 'ACTIVE' || !['OFFICER', 'ADMIN'].includes(membership.role)) {
        throw Errors.permissionDenied();
      }
    }
  }

  private publicMetadata(file: {
    id: string;
    originalName: string;
    displayName?: string | null;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string | null;
    securityClass: string;
    lifecycleState?: string | null;
    processingState: string;
    uploadContext?: string | null;
  }) {
    return {
      fileId: file.id,
      displayName: file.displayName ?? file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      checksumSha256: file.checksumSha256,
      securityClass: asSecurityClass(file.securityClass),
      lifecycleState: asLifecycleState(file),
      processingState: file.processingState,
      uploadContext: file.uploadContext ?? null,
    };
  }

  private async audit(input: {
    event: string;
    fileId: string;
    personId: string;
    securityClass: string;
    action?: FileAction;
  }) {
    const payload = { ...input };
    for (const key of Object.keys(payload)) {
      if (NEVER_LOGGED.has(key)) {
        delete (payload as Record<string, unknown>)[key];
      }
    }
    await this.prisma.fileAccessRecord.create({
      data: {
        id: newId('faud'),
        fileId: payload.fileId,
        personId: payload.personId,
        event: payload.event,
        action: payload.action,
      },
    });
  }
}
