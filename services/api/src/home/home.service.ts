import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  discoverWhen,
  isFirstTimeHome,
  mergeAttention,
  relativeTiming,
  selectUpNext,
  zonedDayBounds,
} from './home-rules';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(personId: string, timezone = 'Africa/Harare', date?: string) {
    const person = await this.prisma.person.findUnique({ where: { id: personId } });
    const now = new Date();
    const { start: dayStart, end: dayEnd } = zonedDayBounds(now, timezone, date);

    const memberships = await this.prisma.classMembership.findMany({
      where: { personId, status: 'ACTIVE' },
    });
    const enrollments = await this.prisma.enrollment.findMany({
      where: { personId, status: 'ACTIVE' },
    });
    const offeringIds = enrollments.map((item: { courseOfferingId: string }) => item.courseOfferingId);
    const classIds = memberships.map((item: { classId: string }) => item.classId);

    const [follows, orgMemberships] = await Promise.all([
      this.prisma.organizationFollow.findMany({
        where: { personId },
        select: { organizationId: true },
      }),
      this.prisma.organizationMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { organizationId: true },
      }),
    ]);
    const followedOrgIds = follows.map((item: { organizationId: string }) => item.organizationId);
    const memberOrgIds = orgMemberships.map((item: { organizationId: string }) => item.organizationId);

    const activityWhere = {
      status: { in: ['SCHEDULED', 'ONGOING'] as ['SCHEDULED', 'ONGOING'] },
      OR: [
        { courseOfferingId: { in: offeringIds.length ? offeringIds : ['__none__'] } },
        { classId: { in: classIds.length ? classIds : ['__none__'] } },
        { organizationId: { in: memberOrgIds.length ? memberOrgIds : ['__none__'] } },
        { organizationId: { not: null }, organization: { visibility: 'PUBLIC' } },
        { ownerPersonId: personId },
      ],
    };

    const [
      upcoming,
      today,
      attention,
      campusAnnouncements,
      discoverEvents,
      discoverOrgs,
      discoverServices,
      campusOrgEvents,
      unreadNotifications,
      unreadImportant,
      unreadMessages,
    ] = await Promise.all([
      this.prisma.activity.findMany({
        where: { ...activityWhere, endTime: { gte: now } },
        include: { courseOffering: { include: { course: true } } },
        orderBy: [{ relevanceWeight: 'desc' }, { startTime: 'asc' }],
        take: 8,
      }),
      this.prisma.activity.findMany({
        where: {
          ...activityWhere,
          startTime: { lt: dayEnd },
          endTime: { gte: dayStart },
        },
        include: { courseOffering: { include: { course: true } } },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),
      this.prisma.attentionItem.findMany({
        where: { personId, resolvedAt: null },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
        take: 5,
      }),
      this.prisma.announcement.findMany({
        where: {
          courseOfferingId: { in: offeringIds.length ? offeringIds : ['__none__'] },
          status: 'PUBLISHED',
        },
        include: {
          author: true,
          courseOffering: { include: { course: true } },
          reads: { where: { personId } },
        },
        orderBy: { publishedAt: 'desc' },
        take: 4,
      }),
      this.prisma.campusEvent.findMany({
        where: { visibility: 'PUBLIC', startsAt: { gte: now } },
        include: { organization: true },
        orderBy: { startsAt: 'asc' },
        take: 3,
      }),
      this.prisma.organization.findMany({
        where: { visibility: 'PUBLIC', status: 'ACTIVE' },
        take: 3,
      }),
      this.prisma.service.findMany({
        where: { visibility: { in: ['PUBLIC', 'CAMPUS'] }, status: { in: ['PUBLISHED', 'AVAILABLE'] } },
        take: 3,
      }),
      this.prisma.campusEvent.findMany({
        where: {
          startsAt: { gte: now },
          OR: [
            { organizationId: { in: memberOrgIds.length ? memberOrgIds : ['__none__'] } },
            {
              visibility: 'PUBLIC',
              organizationId: { in: followedOrgIds.length ? followedOrgIds : ['__none__'] },
            },
          ],
        },
        include: { organization: true },
        orderBy: { startsAt: 'asc' },
        take: 3,
      }),
      this.prisma.notification.count({
        where: { personId, readAt: null },
      }),
      this.prisma.announcement.count({
        where: {
          courseOfferingId: { in: offeringIds.length ? offeringIds : ['__none__'] },
          status: 'PUBLISHED',
          priority: { in: ['IMPORTANT', 'URGENT'] },
          reads: { none: { personId } },
        },
      }),
      this.unreadMessageCount(personId),
    ]);

    const upNext = selectUpNext(upcoming, now);
    const firstTime = isFirstTimeHome({
      enrollmentCount: enrollments.length,
      membershipCount: memberships.length,
    });

    const liveAttention = [
      ...attention.map((item: any) => ({
        id: item.id,
        priority: item.priority,
        title: item.title,
        subtitle: item.subtitle,
        actionLabel: item.actionLabel,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        route: item.route,
      })),
      ...campusAnnouncements
        .filter(
          (item: any) =>
            (item.priority === 'IMPORTANT' || item.priority === 'URGENT') &&
            (item.reads?.length ?? 0) === 0,
        )
        .map((item: any) => ({
          id: `attn_ann_${item.id}`,
          priority: item.priority === 'URGENT' ? 'HIGH' : 'NORMAL',
          title: item.title,
          subtitle: item.courseOffering.course.code,
          actionLabel: 'Read announcement',
          sourceType: 'ANNOUNCEMENT',
          sourceId: item.id,
          route: `/app/learn/announcement/${item.id}`,
        })),
      ...upcoming
        .filter((item: any) =>
          ['ASSIGNMENT_DEADLINE', 'TEST', 'EXAM'].includes(item.type) &&
          item.startTime.getTime() - now.getTime() < 48 * 60 * 60 * 1000,
        )
        .map((item: any) => ({
          id: `attn_act_${item.id}`,
          priority: item.type === 'EXAM' ? 'CRITICAL' : 'HIGH',
          title: item.type === 'ASSIGNMENT_DEADLINE' ? 'Assignment due soon' : `Upcoming ${item.type.toLowerCase()}`,
          subtitle: item.courseOffering
            ? `${item.courseOffering.course.code} · ${item.courseOffering.course.title}`
            : item.title,
          actionLabel: item.type === 'ASSIGNMENT_DEADLINE' ? 'View assignment' : 'View',
          sourceType: item.type,
          sourceId: item.id,
          route: item.courseOffering
            ? `/app/learn/course/${item.courseOffering.id}`
            : `/app/calendar/activity/${item.id}`,
        })),
      ...(person?.accountState === 'STUDENT_VERIFICATION_PENDING' ||
      person?.accountState === 'PROFILE_INCOMPLETE'
        ? [
            {
              id: 'attn_verify',
              priority: 'HIGH',
              title: 'Finish campus verification',
              subtitle: 'Unlock your academic campus',
              actionLabel: 'Review',
              sourceType: 'VERIFICATION',
              sourceId: personId,
              route: '/onboarding/student-verification',
            },
          ]
        : []),
      ...(unreadMessages > 0
        ? [
            {
              id: 'attn_messages',
              priority: 'NORMAL',
              title: unreadMessages === 1 ? '1 unread message' : `${unreadMessages} unread messages`,
              subtitle: 'Open Messages',
              actionLabel: 'Review',
              sourceType: 'CONVERSATION',
              sourceId: personId,
              route: '/app/messages',
            },
          ]
        : []),
    ];

    const primaryClass = await this.prisma.classMembership.findFirst({
      where: { personId, status: 'ACTIVE' },
      include: { class: true },
    });
    const activeSemester = await this.prisma.academicSemester.findFirst({
      orderBy: { startsAt: 'desc' },
    });

    return {
      generatedAt: new Date().toISOString(),
      timezone,
      greetingName: person?.givenName || person?.displayName || null,
      accountState: person?.accountState,
      firstTime,
      upNext: upNext ? [this.serializeActivity(upNext as any, now)] : [],
      today: today
        .filter((item: any) => item.status !== 'CANCELLED' && item.status !== 'COMPLETED')
        .map((item: any) => this.serializeActivity(item, now)),
      attention: mergeAttention(liveAttention),
      campus: [
        ...campusAnnouncements.map((item: any) => ({
          id: item.id,
          kind: 'ANNOUNCEMENT',
          title: item.title,
          subtitle: `${item.courseOffering.course.code} · ${item.author.displayName ?? 'Lecturer'}`,
          route: `/app/learn/course/${item.courseOfferingId}/announcements`,
        })),
        ...[...campusOrgEvents, ...discoverEvents]
          .filter(
            (item: any, index: number, list: any[]) =>
              list.findIndex((candidate: any) => candidate.id === item.id) === index,
          )
          .slice(0, 2)
          .map((item: any) => ({
            id: item.id,
            kind: 'EVENT',
            title: item.title,
            subtitle: discoverWhen(
              item.startsAt,
              timezone,
              item.location ?? item.organization?.name,
            ),
            route: `/app/explore/event/${item.id}`,
          })),
      ].slice(0, 5),
      discover: [
        ...discoverOrgs.map((item: any) => ({
          id: item.id,
          kind: 'ORGANIZATION',
          title: item.name,
          subtitle: item.description,
          route: `/app/explore/organization/${item.id}`,
        })),
        ...discoverEvents.map((item: any) => ({
          id: item.id,
          kind: 'EVENT',
          title: item.title,
          subtitle: discoverWhen(item.startsAt, timezone, item.location ?? item.organization?.name),
          route: `/app/explore/event/${item.id}`,
        })),
        ...discoverServices.map((item: any) => ({
          id: item.id,
          kind: 'SERVICE',
          title: item.title,
          subtitle: item.summary ?? item.description,
          route: `/app/explore/service/${item.id}`,
        })),
      ].slice(0, 6),
      unreadNotificationCount: unreadNotifications,
      unreadMessageCount: unreadMessages,
      unreadImportantAnnouncementCount: unreadImportant,
      context: {
        primaryClassId: primaryClass?.classId ?? null,
        activeSemesterId: activeSemester?.id ?? null,
      },
    };
  }

  private async unreadMessageCount(personId: string): Promise<number> {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { personId, status: 'ACTIVE' },
      select: { conversationId: true },
    });
    const conversationIds = participants.map((item: { conversationId: string }) => item.conversationId);
    if (conversationIds.length === 0) {
      return 0;
    }
    const [messages, readStates] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          conversationId: { in: conversationIds },
          senderId: { not: personId },
          removedAt: null,
        },
        select: { conversationId: true, createdAt: true },
      }),
      this.prisma.messageReadState.findMany({
        where: { personId, conversationId: { in: conversationIds } },
        select: { conversationId: true, lastReadAt: true },
      }),
    ]);
    const lastRead = new Map(
      readStates.map((item: { conversationId: string; lastReadAt: Date }) => [
        item.conversationId,
        item.lastReadAt.getTime(),
      ]),
    );
    return messages.filter((item: { conversationId: string; createdAt: Date }) => {
      const watermark = lastRead.get(item.conversationId) ?? 0;
      return item.createdAt.getTime() > watermark;
    }).length;
  }

  private serializeActivity(
    activity: {
      id: string;
      type: string;
      title: string;
      startTime: Date;
      endTime: Date;
      location: string | null;
      status: string;
      courseOffering?: { id: string; course: { code: string; title: string } } | null;
    },
    now: Date,
  ) {
    return {
      activityId: activity.id,
      type: activity.type,
      title: activity.title,
      source: activity.courseOffering
        ? `${activity.courseOffering.course.code} ${activity.courseOffering.course.title}`
        : null,
      startTime: activity.startTime.toISOString(),
      endTime: activity.endTime.toISOString(),
      location: activity.location,
      status: activity.status,
      relative: relativeTiming(activity.startTime, activity.endTime, activity.status, now),
      courseOfferingId: activity.courseOffering?.id ?? null,
      route: activity.courseOffering
        ? `/app/learn/course/${activity.courseOffering.id}`
        : `/app/calendar/activity/${activity.id}`,
    };
  }
}
