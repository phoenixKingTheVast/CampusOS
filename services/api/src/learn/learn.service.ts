import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { zonedDayBounds } from '../home/home-rules';
import { canIncludeStudyGroup } from '../search/search-rules';

@Injectable()
export class LearnService {
  constructor(private readonly prisma: PrismaService) {}

  async getLearn(personId: string, timezone = 'Africa/Harare', date?: string) {
    const now = new Date();
    const { start: dayStart, end: dayEnd } = zonedDayBounds(now, timezone, date);

    const enrollments = await this.prisma.enrollment.findMany({
      where: { personId, status: 'ACTIVE', courseOffering: { status: 'ACTIVE' } },
      include: {
        courseOffering: {
          include: {
            course: true,
            semester: true,
            personnel: { include: { person: true } },
            activities: {
              where: { status: { in: ['SCHEDULED', 'ONGOING'] }, endTime: { gte: now } },
              orderBy: { startTime: 'asc' },
              take: 1,
            },
            announcements: {
              where: { status: 'PUBLISHED', reads: { none: { personId } } },
            },
          },
        },
      },
    });

    const offeringIds = enrollments.map((item: { courseOfferingId: string }) => item.courseOfferingId);

    const primaryClass = await this.prisma.classMembership.findFirst({
      where: { personId, status: 'ACTIVE' },
      include: {
        class: {
          include: {
            activities: {
              where: { status: { in: ['SCHEDULED', 'ONGOING'] }, endTime: { gte: now } },
            },
          },
        },
      },
    });

    const classAnnouncementCount = primaryClass
      ? await this.prisma.announcement.count({
          where: {
            status: 'PUBLISHED',
            courseOffering: {
              enrollments: { some: { personId, status: 'ACTIVE' } },
            },
          },
        })
      : 0;

    const studyGroupRows = await this.prisma.studyGroup.findMany({
      where: {
        status: { in: ['ACTIVE', 'INACTIVE'] },
        OR: [
          { memberships: { some: { personId, status: 'ACTIVE' } } },
          { visibility: 'PUBLIC' },
          { courseOfferingId: { in: offeringIds.length ? offeringIds : ['__none__'] } },
        ],
      },
      include: {
        memberships: { where: { personId, status: 'ACTIVE' }, take: 1 },
      },
      take: 24,
    });
    const studyGroups = studyGroupRows
      .filter((group: { visibility: string; courseOfferingId: string | null; memberships: unknown[] }) =>
        canIncludeStudyGroup({
          visibility: group.visibility,
          courseOfferingId: group.courseOfferingId,
          isMember: group.memberships.length > 0,
          enrolledOfferingIds: offeringIds,
          campusMember: true,
        }),
      )
      .slice(0, 8);

    const [currentActivities, upcomingActivities, attentionItems] = await Promise.all([
      this.prisma.activity.findMany({
        where: {
          courseOfferingId: { in: offeringIds.length ? offeringIds : ['__none__'] },
          status: { in: ['SCHEDULED', 'ONGOING'] },
          startTime: { lt: dayEnd },
          endTime: { gte: dayStart },
        },
        include: { courseOffering: { include: { course: true } } },
        orderBy: { startTime: 'asc' },
        take: 8,
      }),
      this.prisma.activity.findMany({
        where: {
          courseOfferingId: { in: offeringIds.length ? offeringIds : ['__none__'] },
          status: { in: ['SCHEDULED', 'ONGOING'] },
          startTime: { gte: dayEnd },
        },
        include: { courseOffering: { include: { course: true } } },
        orderBy: { startTime: 'asc' },
        take: 6,
      }),
      this.prisma.attentionItem.findMany({
        where: { personId, resolvedAt: null },
        take: 5,
      }),
    ]);

    return {
      currentActivities: currentActivities.map((item: any) => this.serializeActivity(item)),
      upcomingActivities: upcomingActivities.map((item: any) => this.serializeActivity(item)),
      attentionItems: attentionItems.map((item: any) => ({
        id: item.id,
        title: item.title,
        subtitle: item.subtitle,
        route: item.route,
        priority: item.priority,
      })),
      courses: enrollments.map((item: any) => {
        const lecturer = item.courseOffering.personnel.find((person: any) => person.role === 'LECTURER');
        return {
          courseOfferingId: item.courseOffering.id,
          courseId: item.courseOffering.courseId,
          code: item.courseOffering.course.code,
          title: item.courseOffering.course.title,
          semester: item.courseOffering.semester.label,
          status: item.courseOffering.status,
          lecturer: lecturer?.person.displayName ?? null,
          nextActivity: item.courseOffering.activities[0]
            ? {
                title: item.courseOffering.activities[0].title,
                startTime: item.courseOffering.activities[0].startTime.toISOString(),
              }
            : null,
          unreadAnnouncements: item.courseOffering.announcements.length,
          route: `/app/learn/course/${item.courseOffering.id}`,
        };
      }),
      primaryClass: primaryClass
        ? {
            id: primaryClass.class.id,
            code: primaryClass.class.code,
            name: primaryClass.class.name,
            yearOfStudy: primaryClass.class.yearOfStudy,
            announcementCount: classAnnouncementCount,
            upcomingCount: primaryClass.class.activities.length,
            route: `/app/class/${primaryClass.class.id}`,
          }
        : null,
      studyGroups: studyGroups.map((item: any) => ({
        id: item.id,
        name: item.name,
        memberCount: item.memberCount,
        route: `/app/learn/study-group/${item.id}`,
      })),
    };
  }

  private serializeActivity(activity: {
    id: string;
    type: string;
    title: string;
    startTime: Date;
    endTime: Date;
    status: string;
    courseOffering: { id: string; course: { code: string } } | null;
  }) {
    return {
      id: activity.id,
      type: activity.type,
      title: activity.title,
      startTime: activity.startTime.toISOString(),
      endTime: activity.endTime.toISOString(),
      status: activity.status,
      courseCode: activity.courseOffering?.course.code,
      courseOfferingId: activity.courseOffering?.id ?? null,
      route: activity.courseOffering
        ? `/app/learn/course/${activity.courseOffering.id}`
        : `/app/calendar/activity/${activity.id}`,
    };
  }
}
