import { Injectable } from '@nestjs/common';
import { ReportReason, ResourceRelationshipType, ResourceVisibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import { isHistoricalResource } from './resource-policy';

const METADATA_WINDOW_MS = 45 * 60 * 1000;

@Injectable()
export class ResourcesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async categories() {
    const items = await this.prisma.resourceCategory.findMany({ orderBy: { sortOrder: 'asc' } });
    const groups = new Map<string, { key: string; label: string; items: typeof items }>();
    for (const item of items) {
      const group = groups.get(item.groupKey) ?? {
        key: item.groupKey,
        label: item.groupLabel,
        items: [],
      };
      group.items.push(item);
      groups.set(item.groupKey, group);
    }
    return { groups: [...groups.values()] };
  }

  async list(personId: string, courseOfferingId: string, query?: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    const offering = context.offering;
    const resources = await this.prisma.resource.findMany({
      where: {
        OR: [
          { courseOfferingId },
          { courseId: offering.courseId, courseOfferingId: { not: courseOfferingId }, status: 'PUBLISHED' },
        ],
        status: { in: ['PUBLISHED', 'PROCESSING', 'ARCHIVED'] },
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { description: { contains: query, mode: 'insensitive' } },
                { resourceType: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: this.include(),
      orderBy: { publishedAt: 'desc' },
    });

    const visible = [];
    for (const resource of resources) {
      if (await this.access.canViewResource(personId, resource)) {
        visible.push(this.serialize(resource, personId, offering.id));
      }
    }

    return {
      currentOfferingId: courseOfferingId,
      items: visible,
      permissions: [...context.permissions],
    };
  }

  async get(personId: string, resourceId: string) {
    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        ...this.include(),
        fromRelations: { include: { toResource: { include: { course: true, courseOffering: { include: { semester: true } } } } } },
        toRelations: { include: { fromResource: { include: { course: true, courseOffering: { include: { semester: true } } } } } },
      },
    });
    if (!resource) {
      throw Errors.notFound('This resource has been removed.');
    }
    if (!(await this.access.canViewResource(personId, resource))) {
      throw Errors.permissionDenied("You don't have access to this resource.");
    }
    const activeEndorsement = resource.endorsements.find(
      (item) => item.endorsementType === 'ENDORSED' && !item.revokedAt,
    );
    return {
      ...this.serialize(resource, personId, resource.courseOfferingId),
      description: resource.description,
      related: [
        ...resource.fromRelations.map((rel) => ({
          id: rel.toResource.id,
          type: rel.type,
          title: rel.toResource.title,
          offering: rel.toResource.courseOffering.semester.label,
        })),
        ...resource.toRelations.map((rel) => ({
          id: rel.fromResource.id,
          type: rel.type,
          title: rel.fromResource.title,
          offering: rel.fromResource.courseOffering.semester.label,
        })),
      ],
      endorsement: activeEndorsement
        ? {
            endorserName: activeEndorsement.endorser.displayName,
            comment: activeEndorsement.comment,
            createdAt: activeEndorsement.createdAt.toISOString(),
          }
        : null,
      versions: resource.versions.map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        changeSummary: version.changeSummary,
        createdAt: version.createdAt.toISOString(),
        current: version.id === resource.currentVersionId,
        fileId: version.fileId,
      })),
    };
  }

  async create(
    personId: string,
    courseOfferingId: string,
    input: {
      title: string;
      resourceType: string;
      description?: string;
      fileId: string;
      visibility?: ResourceVisibility;
      categoryId?: string;
    },
  ) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('CREATE_RESOURCE')) {
      throw Errors.permissionDenied();
    }
    const file = await this.prisma.fileObject.findUnique({ where: { id: input.fileId } });
    if (!file || file.uploaderId !== personId) {
      throw Errors.validation('Upload a file before creating this resource.');
    }
    if (file.processingState !== 'READY' && file.processingState !== 'AVAILABLE' && file.lifecycleState !== 'AVAILABLE') {
      throw Errors.validation('This file is still being checked.');
    }
    const now = new Date();
    const resource = await this.prisma.resource.create({
      data: {
        id: newId('res'),
        courseId: context.offering.courseId,
        courseOfferingId,
        title: input.title.trim(),
        description: input.description?.trim(),
        resourceType: input.resourceType,
        categoryId: input.categoryId,
        visibility: input.visibility ?? 'COURSE_MEMBERS',
        status: 'PUBLISHED',
        uploadedById: personId,
        authoredById: personId,
        academicYear: context.offering.semester.year,
        semesterLabel: context.offering.semester.label,
        publishedAt: now,
        editableUntil: new Date(now.getTime() + METADATA_WINDOW_MS),
      },
    });
    const version = await this.prisma.resourceVersion.create({
      data: {
        id: newId('rver'),
        resourceId: resource.id,
        versionNumber: 1,
        fileId: file.id,
        uploadedById: personId,
        checksum: file.checksumSha256,
        changeSummary: 'Initial upload',
        status: 'CURRENT',
      },
    });
    const updated = await this.prisma.resource.update({
      where: { id: resource.id },
      data: { currentVersionId: version.id },
      include: this.include(),
    });
    await this.notifyNewResource(updated);
    return this.serialize(updated, personId, courseOfferingId);
  }

  async updateMetadata(
    personId: string,
    resourceId: string,
    input: {
      title?: string;
      description?: string;
      resourceType?: string;
      categoryId?: string;
      academicYear?: number;
      solutionAvailable?: boolean;
    },
  ) {
    const resource = await this.require(resourceId);
    if (resource.uploadedById !== personId) {
      throw Errors.permissionDenied();
    }
    if (resource.editableUntil < new Date()) {
      throw Errors.validation('Metadata locked. Request a correction.');
    }
    const updated = await this.prisma.resource.update({
      where: { id: resourceId },
      data: {
        title: input.title?.trim(),
        description: input.description?.trim(),
        resourceType: input.resourceType,
        categoryId: input.categoryId,
        academicYear: input.academicYear,
        solutionAvailable: input.solutionAvailable,
        metadataEditedById: personId,
      },
      include: this.include(),
    });
    return this.serialize(updated, personId, updated.courseOfferingId);
  }

  async addVersion(
    personId: string,
    resourceId: string,
    input: { fileId: string; changeSummary?: string },
  ) {
    const resource = await this.require(resourceId);
    const context = await this.access.courseContext(personId, resource.courseOfferingId);
    if (resource.uploadedById !== personId && !context?.can('EDIT_RESOURCE')) {
      throw Errors.permissionDenied();
    }
    const file = await this.prisma.fileObject.findUnique({ where: { id: input.fileId } });
    if (!file || (file.processingState !== 'READY' && file.processingState !== 'AVAILABLE' && file.lifecycleState !== 'AVAILABLE')) {
      throw Errors.validation('This file is still being checked.');
    }
    const latest = await this.prisma.resourceVersion.findFirst({
      where: { resourceId },
      orderBy: { versionNumber: 'desc' },
    });
    await this.prisma.resourceVersion.updateMany({
      where: { resourceId, status: 'CURRENT' },
      data: { status: 'SUPERSEDED' },
    });
    const version = await this.prisma.resourceVersion.create({
      data: {
        id: newId('rver'),
        resourceId,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        fileId: file.id,
        uploadedById: personId,
        checksum: file.checksumSha256,
        changeSummary: input.changeSummary,
        status: 'CURRENT',
      },
    });
    const updated = await this.prisma.resource.update({
      where: { id: resourceId },
      data: { currentVersionId: version.id },
      include: this.include(),
    });
    return this.serialize(updated, personId, updated.courseOfferingId);
  }

  async endorse(personId: string, resourceId: string, comment?: string) {
    const resource = await this.require(resourceId);
    const context = await this.access.courseContext(personId, resource.courseOfferingId);
    if (!context?.can('ENDORSE_RESOURCE')) {
      throw Errors.permissionDenied();
    }
    const endorsement = await this.prisma.resourceEndorsement.create({
      data: {
        id: newId('rend'),
        resourceId,
        endorserId: personId,
        endorsementType: 'ENDORSED',
        comment,
      },
    });
    return endorsement;
  }

  async relate(
    personId: string,
    resourceId: string,
    toResourceId: string,
    type: ResourceRelationshipType,
  ) {
    const resource = await this.require(resourceId);
    const context = await this.access.courseContext(personId, resource.courseOfferingId);
    if (!context?.can('EDIT_RESOURCE') && resource.uploadedById !== personId) {
      throw Errors.permissionDenied();
    }
    return this.prisma.resourceRelationship.create({
      data: {
        id: newId('rrel'),
        fromResourceId: resourceId,
        toResourceId,
        type,
      },
    });
  }

  async share(personId: string, resourceId: string) {
    const resource = await this.get(personId, resourceId);
    return {
      resourceId: resource.id,
      title: resource.title,
      resourceType: resource.resourceType,
      endorsed: resource.endorsed,
      reference: `campusos://resource/${resource.id}`,
    };
  }

  async report(personId: string, resourceId: string, input: { reason?: string; details?: string }) {
    await this.get(personId, resourceId);
    return this.prisma.moderationReport.create({
      data: {
        id: newId('rpt'),
        reporterId: personId,
        targetType: 'RESOURCE',
        targetId: resourceId,
        reason: Object.values(ReportReason).includes(input.reason as ReportReason)
          ? (input.reason as ReportReason)
          : ReportReason.OTHER,
        details: input.details,
      },
    });
  }

  private async notifyNewResource(resource: { id: string; title: string; courseOfferingId: string; uploadedById: string }) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseOfferingId: resource.courseOfferingId, status: 'ACTIVE' },
    });
    await this.notifications.emitMany(
      enrollments
        .filter((item) => item.personId !== resource.uploadedById)
        .map((item) => ({
          personId: item.personId,
          type: 'RESOURCE_PUBLISHED',
          category: 'ACADEMIC' as const,
          title: 'New resource',
          body: resource.title,
          sourceType: 'RESOURCE',
          sourceId: resource.id,
          resourceId: resource.id,
          sourceEventId: resource.id,
        })),
    );
  }

  private async require(id: string) {
    const resource = await this.prisma.resource.findUnique({ where: { id } });
    if (!resource) {
      throw Errors.notFound('This resource has been removed.');
    }
    return resource;
  }

  private include() {
    return {
      course: true,
      courseOffering: { include: { semester: true } },
      uploadedBy: true,
      authoredBy: true,
      category: true,
      versions: { include: { file: true }, orderBy: { versionNumber: 'desc' as const } },
      endorsements: { include: { endorser: true } },
    };
  }

  private serialize(
    resource: {
      id: string;
      title: string;
      description: string | null;
      resourceType: string;
      courseId: string;
      courseOfferingId: string;
      visibility: string;
      status: string;
      uploadedById: string;
      authoredById: string;
      currentVersionId: string | null;
      academicYear: number | null;
      semesterLabel: string | null;
      solutionAvailable: boolean;
      publishedAt: Date | null;
      editableUntil: Date;
      createdAt: Date;
      updatedAt: Date;
      course: { code: string; title: string };
      courseOffering: { status: string; semester: { label: string } };
      uploadedBy: { displayName: string | null };
      authoredBy: { displayName: string | null };
      category: { key: string; label: string; groupKey: string; groupLabel: string } | null;
      versions: Array<{
        id: string;
        versionNumber: number;
        fileId: string;
        file: { mimeType: string; sizeBytes: number; originalName: string };
      }>;
      endorsements: Array<{ endorsementType: string; revokedAt: Date | null; endorser: { displayName: string | null } }>;
    },
    personId: string,
    currentOfferingId: string,
  ) {
    const current = resource.versions[0];
    const endorsed = resource.endorsements.some(
      (item) => item.endorsementType === 'ENDORSED' && !item.revokedAt,
    );
    const canEditMetadata = resource.uploadedById === personId && resource.editableUntil > new Date();
    return {
      id: resource.id,
      title: resource.title,
      description: resource.description,
      resourceType: resource.resourceType,
      courseId: resource.courseId,
      courseOfferingId: resource.courseOfferingId,
      courseCode: resource.course.code,
      courseTitle: resource.course.title,
      offeringLabel: resource.courseOffering.semester.label,
      historical: isHistoricalResource(resource.courseOfferingId, currentOfferingId),
      visibility: resource.visibility,
      status: resource.status,
      uploadedBy: resource.uploadedBy.displayName,
      authoredBy: resource.authoredBy.displayName,
      category: resource.category,
      currentVersionId: resource.currentVersionId,
      versionNumber: current?.versionNumber ?? 1,
      fileId: current?.fileId,
      mimeType: current?.file.mimeType,
      sizeBytes: current?.file.sizeBytes,
      originalName: current?.file.originalName,
      academicYear: resource.academicYear,
      semesterLabel: resource.semesterLabel,
      solutionAvailable: resource.solutionAvailable,
      endorsed,
      endorserName: endorsed
        ? resource.endorsements.find((item) => !item.revokedAt)?.endorser.displayName
        : null,
      publishedAt: resource.publishedAt?.toISOString() ?? null,
      createdAt: resource.createdAt.toISOString(),
      canEditMetadata,
      editableUntil: resource.editableUntil.toISOString(),
    };
  }
}
