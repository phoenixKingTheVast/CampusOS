import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

@Injectable()
export class LaboratoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async list(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    const items = await this.prisma.laboratoryActivity.findMany({
      where: { courseOfferingId },
      include: { resources: true },
      orderBy: { startAt: 'asc' },
    });
    return { items: items.map((item) => this.serialize(item)), permissions: [...context.permissions] };
  }

  async get(personId: string, laboratoryId: string) {
    const item = await this.prisma.laboratoryActivity.findUnique({
      where: { id: laboratoryId },
      include: { resources: true, courseOffering: { include: { course: true } } },
    });
    if (!item) {
      throw Errors.notFound();
    }
    const context = await this.access.courseContext(personId, item.courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    const resources = await this.prisma.resource.findMany({
      where: { id: { in: item.resources.map((row) => row.resourceId) } },
    });
    return {
      ...this.serialize(item),
      courseCode: item.courseOffering.course.code,
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        resourceType: resource.resourceType,
      })),
    };
  }

  async create(
    personId: string,
    courseOfferingId: string,
    input: {
      title: string;
      description?: string;
      objective?: string;
      location?: string;
      startAt?: string;
      endAt?: string;
      instructions?: string;
      preparation?: unknown;
      safetyLevel?: string;
      safetyInstructions?: string;
      requiredPpe?: unknown;
      hazards?: unknown;
      equipment?: unknown;
      resourceIds?: string[];
      assessmentId?: string;
    },
  ) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('CREATE_LABORATORY')) {
      throw Errors.permissionDenied();
    }
    const lab = await this.prisma.laboratoryActivity.create({
      data: {
        id: newId('lab'),
        courseOfferingId,
        title: input.title.trim(),
        description: input.description,
        objective: input.objective,
        location: input.location,
        startAt: input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt ? new Date(input.endAt) : null,
        instructions: input.instructions,
        preparation: (input.preparation as Prisma.InputJsonValue) ?? [],
        safetyLevel: input.safetyLevel,
        safetyInstructions: input.safetyInstructions,
        requiredPpe: (input.requiredPpe as Prisma.InputJsonValue) ?? [],
        hazards: (input.hazards as Prisma.InputJsonValue) ?? [],
        equipment: (input.equipment as Prisma.InputJsonValue) ?? [],
        assessmentId: input.assessmentId,
        createdById: personId,
        status: 'PUBLISHED',
      },
      include: { resources: true },
    });
    if (input.resourceIds?.length) {
      await this.prisma.laboratoryResource.createMany({
        data: input.resourceIds.map((resourceId) => ({
          id: newId('labr'),
          laboratoryId: lab.id,
          resourceId,
        })),
      });
    }
    await this.syncActivity(lab, courseOfferingId);
    return this.serialize(lab);
  }

  async update(personId: string, laboratoryId: string, input: Record<string, unknown>) {
    const existing = await this.prisma.laboratoryActivity.findUnique({ where: { id: laboratoryId } });
    if (!existing) {
      throw Errors.notFound();
    }
    const context = await this.access.courseContext(personId, existing.courseOfferingId);
    if (!context?.can('EDIT_LABORATORY')) {
      throw Errors.permissionDenied();
    }
    const updated = await this.prisma.laboratoryActivity.update({
      where: { id: laboratoryId },
      data: {
        title: typeof input.title === 'string' ? input.title : undefined,
        objective: typeof input.objective === 'string' ? input.objective : undefined,
        location: typeof input.location === 'string' ? input.location : undefined,
        instructions: typeof input.instructions === 'string' ? input.instructions : undefined,
        safetyInstructions:
          typeof input.safetyInstructions === 'string' ? input.safetyInstructions : undefined,
        startAt: typeof input.startAt === 'string' ? new Date(input.startAt) : undefined,
        endAt: typeof input.endAt === 'string' ? new Date(input.endAt) : undefined,
      },
      include: { resources: true },
    });
    await this.syncActivity(updated, existing.courseOfferingId);
    return this.serialize(updated);
  }

  async publish(personId: string, laboratoryId: string) {
    const existing = await this.prisma.laboratoryActivity.findUnique({ where: { id: laboratoryId } });
    if (!existing) {
      throw Errors.notFound();
    }
    const context = await this.access.courseContext(personId, existing.courseOfferingId);
    if (!context?.can('PUBLISH_LABORATORY')) {
      throw Errors.permissionDenied();
    }
    const updated = await this.prisma.laboratoryActivity.update({
      where: { id: laboratoryId },
      data: { status: 'PUBLISHED' },
      include: { resources: true },
    });
    await this.syncActivity(updated, existing.courseOfferingId);
    return this.serialize(updated);
  }

  private async syncActivity(
    lab: { id: string; title: string; startAt: Date | null; endAt: Date | null; location: string | null },
    courseOfferingId: string,
  ) {
    if (!lab.startAt) {
      return;
    }
    const existing = await this.prisma.activity.findFirst({ where: { laboratoryId: lab.id } });
    const data = {
      type: 'LABORATORY' as const,
      title: lab.title,
      startTime: lab.startAt,
      endTime: lab.endAt ?? lab.startAt,
      location: lab.location,
      status: 'SCHEDULED' as const,
      relevanceWeight: 75,
      sourceType: 'LABORATORY',
      sourceId: lab.id,
      courseOfferingId,
      laboratoryId: lab.id,
    };
    if (existing) {
      await this.prisma.activity.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.activity.create({ data: { id: newId('activity'), ...data } });
    }
  }

  private serialize(item: {
    id: string;
    courseOfferingId: string;
    title: string;
    description: string | null;
    objective: string | null;
    location: string | null;
    startAt: Date | null;
    endAt: Date | null;
    status: string;
    instructions: string | null;
    preparation: Prisma.JsonValue;
    safetyLevel: string | null;
    safetyInstructions: string | null;
    requiredPpe: Prisma.JsonValue;
    hazards: Prisma.JsonValue;
    equipment: Prisma.JsonValue;
    assessmentId: string | null;
  }) {
    const now = Date.now();
    const upcoming = item.startAt ? item.startAt.getTime() > now : false;
    return {
      id: item.id,
      courseOfferingId: item.courseOfferingId,
      title: item.title,
      description: item.description,
      objective: item.objective,
      location: item.location,
      startAt: item.startAt?.toISOString() ?? null,
      endAt: item.endAt?.toISOString() ?? null,
      status: upcoming ? 'UPCOMING' : item.status,
      instructions: item.instructions,
      preparation: item.preparation,
      safety: {
        level: item.safetyLevel,
        instructions: item.safetyInstructions,
        requiredPpe: item.requiredPpe,
        hazards: item.hazards,
      },
      equipment: item.equipment,
      assessmentId: item.assessmentId,
      route: `/app/learn/laboratory/${item.id}`,
    };
  }
}
