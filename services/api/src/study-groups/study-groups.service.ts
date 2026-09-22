import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { Errors } from '../common/errors';
import { newId } from '../common/crypto';
import {
  evaluateJoin,
  studyGroupActions,
  studyGroupDiscoverable,
} from './study-group-policy';

@Injectable()
export class StudyGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async listForCourse(personId: string, courseOfferingId: string) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('VIEW')) {
      throw Errors.permissionDenied();
    }
    const items = await this.prisma.studyGroup.findMany({
      where: { courseOfferingId },
      include: { memberships: { where: { personId } } },
      take: 30,
    });
    return {
      items: items
        .filter((item) => studyGroupDiscoverable(item.status as never) || item.memberships.length > 0)
        .map((item) => {
          const membership = item.memberships[0] ?? null;
          return this.serialize(
            item,
            membership,
            studyGroupActions({
              role: (membership?.role as never) ?? null,
              membership: (membership?.status as never) ?? null,
              status: item.status as never,
            }),
          );
        }),
      permissions: [...context.permissions],
    };
  }

  async get(personId: string, studyGroupId: string) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id: studyGroupId },
      include: {
        memberships: { include: { person: true } },
        courseOffering: { include: { course: true } },
      },
    });
    if (!group) {
      throw Errors.notFound('This study group is no longer available.');
    }
    const mine = group.memberships.find((item) => item.personId === personId) ?? null;
    const enrolled = group.courseOfferingId
      ? Boolean(
          await this.prisma.enrollment.findFirst({
            where: {
              courseOfferingId: group.courseOfferingId,
              personId,
              status: 'ACTIVE',
            },
          }),
        )
      : false;
    if (!studyGroupDiscoverable(group.status as never) && mine?.status !== 'ACTIVE') {
      throw Errors.notFound('This study group is no longer available.');
    }
    const actions = studyGroupActions({
      role: (mine?.role as never) ?? null,
      membership: (mine?.status as never) ?? null,
      status: group.status as never,
    });
    return {
      ...this.serialize(group, mine, actions),
      description: group.description,
      courseCode: group.courseOffering?.course.code ?? null,
      members:
        mine?.status === 'ACTIVE'
          ? group.memberships
              .filter((item) => item.status === 'ACTIVE')
              .map((item) => ({
                id: item.person.id,
                name: item.person.displayName,
                role: item.role,
              }))
          : [],
      conversationId: mine?.status === 'ACTIVE' ? group.conversationId : null,
      enrolledInCourse: enrolled,
    };
  }

  async create(personId: string, courseOfferingId: string, input: { name: string; description?: string }) {
    const context = await this.access.courseContext(personId, courseOfferingId);
    if (!context?.can('CREATE_STUDY_GROUP')) {
      throw Errors.permissionDenied();
    }
    const conversation = await this.prisma.conversation.create({
      data: {
        id: newId('conv'),
        kind: 'STUDY_GROUP',
        title: input.name.trim(),
        createdById: personId,
        contextType: 'STUDY_GROUP',
      },
    });
    const group = await this.prisma.studyGroup.create({
      data: {
        id: newId('sg'),
        name: input.name.trim(),
        description: input.description?.trim(),
        createdById: personId,
        courseOfferingId,
        visibility: 'COURSE_MEMBERS',
        membershipPolicy: 'OPEN',
        status: 'ACTIVE',
        memberCount: 1,
        conversationId: conversation.id,
      },
      include: { memberships: true },
    });
    await this.prisma.studyGroupMembership.create({
      data: {
        id: newId('sgm'),
        studyGroupId: group.id,
        personId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await this.prisma.conversationParticipant.create({
      data: {
        id: newId('cpart'),
        conversationId: conversation.id,
        personId,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { contextId: group.id },
    });
    return this.get(personId, group.id);
  }

  async join(personId: string, studyGroupId: string) {
    const group = await this.prisma.studyGroup.findUnique({
      where: { id: studyGroupId },
      include: { memberships: { where: { personId } } },
    });
    if (!group) {
      throw Errors.notFound();
    }
    if (group.memberships[0]?.status === 'ACTIVE') {
      return this.get(personId, studyGroupId);
    }
    const enrolled = group.courseOfferingId
      ? Boolean(
          await this.prisma.enrollment.findFirst({
            where: { courseOfferingId: group.courseOfferingId, personId, status: 'ACTIVE' },
          }),
        )
      : false;
    const classMember = Boolean(
      await this.prisma.classMembership.findFirst({ where: { personId, status: 'ACTIVE' } }),
    );
    const decision = evaluateJoin({
      authenticated: true,
      status: group.status as never,
      visibility: group.visibility,
      joinPolicy: group.membershipPolicy,
      enrolledInCourse: enrolled,
      memberOfClass: classMember,
      campusMember: true,
      invited: false,
      memberCount: group.memberCount,
      capacity: group.maxMembers,
    });
    if (decision.outcome === 'DENIED') {
      throw Errors.permissionDenied(decision.reason);
    }
    const status = decision.outcome === 'JOINED' ? 'ACTIVE' : 'PENDING';
    await this.prisma.studyGroupMembership.upsert({
      where: { studyGroupId_personId: { studyGroupId, personId } },
      update: { status },
      create: {
        id: newId('sgm'),
        studyGroupId,
        personId,
        status,
        role: 'MEMBER',
      },
    });
    if (status === 'ACTIVE') {
      if (group.conversationId) {
        await this.prisma.conversationParticipant.upsert({
          where: {
            conversationId_personId: { conversationId: group.conversationId, personId },
          },
          update: { status: 'ACTIVE' },
          create: {
            id: newId('cpart'),
            conversationId: group.conversationId,
            personId,
            role: 'MEMBER',
            status: 'ACTIVE',
          },
        });
      }
      await this.prisma.studyGroup.update({
        where: { id: studyGroupId },
        data: { memberCount: { increment: 1 } },
      });
    }
    return this.get(personId, studyGroupId);
  }

  private serialize(
    item: {
      id: string;
      name: string;
      description?: string | null;
      status: string;
      visibility: string;
      membershipPolicy: string;
      memberCount: number;
      courseOfferingId: string | null;
    },
    membership: { status: string; role: string } | null,
    actions: string[],
  ) {
    return {
      id: item.id,
      name: item.name,
      description: item.description ?? null,
      status: item.status,
      visibility: item.visibility,
      memberCount: item.memberCount,
      membershipStatus: membership?.status ?? 'NONE',
      role: membership?.role ?? null,
      actions,
      route: `/app/learn/study-group/${item.id}`,
    };
  }
}
