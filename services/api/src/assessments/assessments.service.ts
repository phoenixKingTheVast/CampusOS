import { Injectable } from '@nestjs/common';
import { AssessmentStatus, Prisma, SubmissionMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';

const STUDENT_VISIBLE: AssessmentStatus[] = [
  'PUBLISHED',
  'OPEN',
  'CLOSED',
  'ARCHIVED',
  'EXTENDED',
  'SCHEDULED',
  'ONGOING',
  'COMPLETED',
];

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(personId: string, courseOfferingId: string, type?: string) {
    const context = await this.requireView(personId, courseOfferingId);
    const items = await this.prisma.assessment.findMany({
      where: {
        courseOfferingId,
        ...(type ? { assessmentType: type } : {}),
        status: context.isLecturer ? undefined : { in: STUDENT_VISIBLE },
      },
      include: { resources: true, courseOffering: { include: { course: true, semester: true } } },
      orderBy: [{ dueAt: 'asc' }, { startAt: 'asc' }],
    });
    return {
      items: items.map((item) => this.serialize(item)),
      permissions: [...context.permissions],
    };
  }

  async get(personId: string, assessmentId: string) {
    const item = await this.prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        resources: true,
        courseOffering: { include: { course: true, semester: true } },
        activities: true,
      },
    });
    if (!item) {
      throw Errors.notFound();
    }
    const context = await this.requireView(personId, item.courseOfferingId);
    if (!context.isLecturer && !STUDENT_VISIBLE.includes(item.status)) {
      throw Errors.permissionDenied();
    }
    const relatedResources = await this.prisma.resource.findMany({
      where: { id: { in: item.resources.map((row) => row.resourceId) } },
    });
    return {
      ...this.serialize(item),
      resources: relatedResources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        resourceType: resource.resourceType,
      })),
      permissions: [...context.permissions],
      submissionBoundary: this.submissionBoundary(item.submissionMode),
    };
  }

  async create(
    personId: string,
    courseOfferingId: string,
    input: {
      title: string;
      assessmentType: string;
      description?: string;
      instructions?: string;
      dueAt?: string;
      startAt?: string;
      endAt?: string;
      weight?: number;
      location?: string;
      topics?: string[];
      submissionMode?: SubmissionMode;
      externalSubmissionUrl?: string;
      resourceIds?: string[];
    },
  ) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('CREATE_ASSESSMENT')) {
      throw Errors.permissionDenied();
    }
    const assessment = await this.prisma.assessment.create({
      data: {
        id: newId('asm'),
        courseOfferingId,
        title: input.title.trim(),
        assessmentType: input.assessmentType,
        description: input.description,
        instructions: input.instructions,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        startAt: input.startAt ? new Date(input.startAt) : null,
        endAt: input.endAt ? new Date(input.endAt) : null,
        weight: input.weight,
        location: input.location,
        topics: input.topics ?? [],
        submissionMode: input.submissionMode ?? 'NONE',
        externalSubmissionUrl: input.externalSubmissionUrl,
        createdById: personId,
        updatedById: personId,
        status: 'DRAFT',
      },
      include: { resources: true, courseOffering: { include: { course: true, semester: true } } },
    });
    if (input.resourceIds?.length) {
      await this.prisma.assessmentResource.createMany({
        data: input.resourceIds.map((resourceId) => ({
          id: newId('asmr'),
          assessmentId: assessment.id,
          resourceId,
        })),
      });
    }
    await this.audit(assessment.id, personId, 'CREATE', null, 'DRAFT', null, assessment);
    return this.serialize(assessment);
  }

  async update(personId: string, assessmentId: string, input: Record<string, unknown>) {
    const existing = await this.requireAssessment(assessmentId);
    const context = await this.access.courseContext(personId, existing.courseOfferingId);
    if (!context?.can('EDIT_ASSESSMENT')) {
      throw Errors.permissionDenied();
    }
    const previousDue = existing.dueAt;
    const previousLocation = existing.location;
    const data: Prisma.AssessmentUpdateInput = {
      updatedBy: { connect: { id: personId } },
    };
    if (typeof input.title === 'string') data.title = input.title;
    if (typeof input.description === 'string') data.description = input.description;
    if (typeof input.instructions === 'string') data.instructions = input.instructions;
    if (typeof input.dueAt === 'string') data.dueAt = new Date(input.dueAt);
    if (typeof input.startAt === 'string') data.startAt = new Date(input.startAt);
    if (typeof input.endAt === 'string') data.endAt = new Date(input.endAt);
    if (typeof input.location === 'string') data.location = input.location;
    if (typeof input.weight === 'number') data.weight = input.weight;
    if (typeof input.externalSubmissionUrl === 'string') {
      data.externalSubmissionUrl = input.externalSubmissionUrl;
    }

    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data,
      include: { resources: true, courseOffering: { include: { course: true, semester: true } } },
    });
    await this.syncActivity(updated);
    await this.audit(updated.id, personId, 'UPDATE', existing.status, updated.status, existing, updated);

    if (previousDue?.toISOString() !== updated.dueAt?.toISOString() && updated.dueAt) {
      await this.notifyEnrolled(
        updated.courseOfferingId,
        `${updated.courseOffering.course.code} ${updated.title} updated`,
        `Due date changed${previousDue ? ` from ${previousDue.toISOString()}` : ''} to ${updated.dueAt.toISOString()}.`,
        updated.id,
      );
    }
    if (previousLocation !== updated.location && updated.location) {
      await this.notifyEnrolled(
        updated.courseOfferingId,
        `${updated.courseOffering.course.code} ${updated.title}`,
        `Venue updated: ${updated.location}`,
        updated.id,
      );
    }
    return this.serialize(updated);
  }

  async publish(personId: string, assessmentId: string) {
    const existing = await this.requireAssessment(assessmentId);
    const context = await this.access.courseContext(personId, existing.courseOfferingId);
    if (!context?.can('PUBLISH_ASSESSMENT')) {
      throw Errors.permissionDenied();
    }
    const status = this.publishedStatus(existing);
    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status, publishedAt: new Date(), updatedById: personId },
      include: { resources: true, courseOffering: { include: { course: true, semester: true } } },
    });
    await this.syncActivity(updated);
    await this.audit(updated.id, personId, 'PUBLISH', existing.status, status, existing, updated);
    return this.serialize(updated);
  }

  async cancel(personId: string, assessmentId: string) {
    const existing = await this.requireAssessment(assessmentId);
    const context = await this.access.courseContext(personId, existing.courseOfferingId);
    if (!context?.can('CANCEL_ASSESSMENT')) {
      throw Errors.permissionDenied();
    }
    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'CANCELLED', updatedById: personId },
      include: { resources: true, courseOffering: { include: { course: true, semester: true } } },
    });
    await this.prisma.activity.updateMany({
      where: { assessmentId },
      data: { status: 'CANCELLED' },
    });
    await this.audit(updated.id, personId, 'CANCEL', existing.status, 'CANCELLED', existing, updated);
    return this.serialize(updated);
  }

  async archive(personId: string, assessmentId: string) {
    const existing = await this.requireAssessment(assessmentId);
    const context = await this.access.courseContext(personId, existing.courseOfferingId);
    if (!context?.can('ARCHIVE_ASSESSMENT')) {
      throw Errors.permissionDenied();
    }
    const updated = await this.prisma.assessment.update({
      where: { id: assessmentId },
      data: { status: 'ARCHIVED', updatedById: personId },
      include: { resources: true, courseOffering: { include: { course: true, semester: true } } },
    });
    await this.audit(updated.id, personId, 'ARCHIVE', existing.status, 'ARCHIVED', existing, updated);
    return this.serialize(updated);
  }

  private publishedStatus(item: { assessmentType: string; startAt: Date | null; dueAt: Date | null }) {
    if (item.assessmentType === 'TEST' || item.assessmentType === 'EXAM') {
      return 'SCHEDULED';
    }
    return 'PUBLISHED';
  }

  private async syncActivity(assessment: {
    id: string;
    title: string;
    assessmentType: string;
    courseOfferingId: string;
    dueAt: Date | null;
    startAt: Date | null;
    endAt: Date | null;
    location: string | null;
    status: AssessmentStatus;
    courseOffering: { course: { code: string } };
  }) {
    if (assessment.status === 'DRAFT' || assessment.status === 'CANCELLED') {
      return;
    }
    const start = assessment.startAt ?? assessment.dueAt;
    if (!start) {
      return;
    }
    const end = assessment.endAt ?? assessment.dueAt ?? start;
    const type =
      assessment.assessmentType === 'TEST'
        ? 'TEST'
        : assessment.assessmentType === 'EXAM'
          ? 'EXAM'
          : 'ASSIGNMENT_DEADLINE';
    const existing = await this.prisma.activity.findFirst({ where: { assessmentId: assessment.id } });
    const data = {
      type: type as 'TEST' | 'EXAM' | 'ASSIGNMENT_DEADLINE',
      title: `${assessment.courseOffering.course.code} ${assessment.title}`,
      startTime: start,
      endTime: end,
      location: assessment.location,
      status: assessment.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED',
      relevanceWeight: assessment.assessmentType === 'EXAM' ? 95 : 90,
      sourceType: 'ASSESSMENT',
      sourceId: assessment.id,
      courseOfferingId: assessment.courseOfferingId,
      assessmentId: assessment.id,
    } as const;
    if (existing) {
      await this.prisma.activity.update({ where: { id: existing.id }, data });
    } else {
      await this.prisma.activity.create({ data: { id: newId('activity'), ...data } });
    }
  }

  private async notifyEnrolled(courseOfferingId: string, title: string, body: string, sourceId: string) {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { courseOfferingId, status: 'ACTIVE' },
    });
    await this.notifications.emitMany(
      enrollments.map((item) => ({
        personId: item.personId,
        type: 'ASSIGNMENT_CHANGED',
        category: 'ACADEMIC' as const,
        title,
        body,
        sourceType: 'ASSESSMENT',
        sourceId,
        priority: 'HIGH' as const,
        sourceEventId: `${sourceId}:${body}`,
      })),
    );
  }

  private async audit(
    assessmentId: string,
    actorId: string,
    action: string,
    previousState: string | null,
    newState: string,
    previousValues: unknown,
    newValues: unknown,
  ) {
    await this.prisma.assessmentAuditEvent.create({
      data: {
        id: newId('aaud'),
        assessmentId,
        actorId,
        action,
        previousState,
        newState,
        previousValues: previousValues as Prisma.InputJsonValue,
        newValues: newValues as Prisma.InputJsonValue,
      },
    });
  }

  private async requireView(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    return context;
  }

  private async requireAssessment(id: string) {
    const item = await this.prisma.assessment.findUnique({
      where: { id },
      include: { courseOffering: { include: { course: true } } },
    });
    if (!item) {
      throw Errors.notFound();
    }
    return item;
  }

  private submissionBoundary(mode: SubmissionMode) {
    if (mode === 'EXTERNAL') {
      return {
        mode,
        label: 'Submission handled externally',
        canSubmitInCampusOs: false,
        offlineMessage:
          "You're offline. This assignment must be submitted through the external submission system. Connect to the internet to continue.",
        leavingCampusOs: "You're leaving CampusOS. Submission will take place on the external university system.",
      };
    }
    if (mode === 'CAMPUSOS') {
      return {
        mode,
        label: 'Native submission is not available in this CampusOS release.',
        canSubmitInCampusOs: false,
      };
    }
    return {
      mode,
      label: 'In-person assessment. CampusOS does not receive submissions for this assessment.',
      canSubmitInCampusOs: false,
    };
  }

  private serialize(item: {
    id: string;
    courseOfferingId: string;
    title: string;
    description: string | null;
    assessmentType: string;
    status: AssessmentStatus;
    publishedAt: Date | null;
    dueAt: Date | null;
    startAt: Date | null;
    endAt: Date | null;
    timezone: string;
    weight: Prisma.Decimal | null;
    instructions: string | null;
    location: string | null;
    topics: Prisma.JsonValue;
    submissionMode: SubmissionMode;
    externalSubmissionUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    courseOffering?: { course: { code: string; title: string }; semester: { label: string } };
  }) {
    return {
      id: item.id,
      courseOfferingId: item.courseOfferingId,
      title: item.title,
      description: item.description,
      assessmentType: item.assessmentType,
      status: item.status,
      publishedAt: item.publishedAt?.toISOString() ?? null,
      dueAt: item.dueAt?.toISOString() ?? null,
      startAt: item.startAt?.toISOString() ?? null,
      endAt: item.endAt?.toISOString() ?? null,
      timezone: item.timezone,
      weight: item.weight ? Number(item.weight) : null,
      instructions: item.instructions,
      location: item.location,
      topics: item.topics,
      submissionMode: item.submissionMode,
      externalSubmissionUrl: item.externalSubmissionUrl,
      courseCode: item.courseOffering?.course.code,
      courseTitle: item.courseOffering?.course.title,
      offeringLabel: item.courseOffering?.semester.label,
      urgency: this.urgency(item.dueAt ?? item.startAt),
      route: `/app/learn/assignment/${item.id}`,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private urgency(date: Date | null) {
    if (!date) {
      return null;
    }
    const delta = date.getTime() - Date.now();
    const days = Math.ceil(delta / (24 * 60 * 60 * 1000));
    if (delta < 0) return 'Closed';
    if (days <= 1) return 'Due tomorrow';
    return `Due in ${days} days`;
  }
}
