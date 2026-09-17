import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../common/access.service';
import { newId } from '../common/crypto';
import { canAppearInPeopleSearch, DEFAULT_PRIVACY, isBlocked } from '../people/social-rules';
import {
  canIncludeStudyGroup,
  normalizeSearchType,
  objectTypeLabel,
  rankSearchHits,
  SearchHit,
} from './search-rules';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {}

  async search(personId: string, query: string, type = 'all', limit = 24) {
    const q = query.trim();
    if (q.length < 2) {
      return { items: [], scope: 'LIVE' };
    }

    const normalizedType = normalizeSearchType(type);
    await this.prisma.searchHistory.create({
      data: { id: newId('srh'), personId, query: q },
    });

    const enrollments = await this.prisma.enrollment.findMany({
      where: { personId, status: 'ACTIVE' },
      select: { courseOfferingId: true },
    });
    const enrolledOfferingIds = enrollments.map((item: { courseOfferingId: string }) => item.courseOfferingId);
    const include = (expected: string) => normalizedType === 'all' || normalizedType === expected;

    const people = include('people')
      ? await this.prisma.person.findMany({
          where: {
            OR: [
              { displayName: { contains: q, mode: 'insensitive' } },
              { username: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
        })
      : [];
    const courses = include('courses')
      ? await this.prisma.course.findMany({
          where: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { title: { contains: q, mode: 'insensitive' } },
            ],
          },
          include: { offerings: { where: { status: 'ACTIVE' }, include: { semester: true } } },
          take: 8,
        })
      : [];
    const classes = include('classes')
      ? await this.prisma.academicClass.findMany({
          where: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { name: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
        })
      : [];
    const organizations = include('organizations')
      ? await this.prisma.organization.findMany({
          where: {
            visibility: 'PUBLIC',
            status: 'ACTIVE',
            name: { contains: q, mode: 'insensitive' },
          },
          take: 8,
        })
      : [];
    const events = include('events')
      ? await this.prisma.campusEvent.findMany({
          where: {
            visibility: 'PUBLIC',
            title: { contains: q, mode: 'insensitive' },
          },
          take: 8,
        })
      : [];
    const resources = include('resources')
      ? await this.prisma.resource.findMany({
          where: {
            status: { in: ['PUBLISHED', 'ARCHIVED'] },
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { description: { contains: q, mode: 'insensitive' } },
              { resourceType: { contains: q, mode: 'insensitive' } },
            ],
          },
          include: { course: true, courseOffering: { include: { semester: true } } },
          take: 20,
        })
      : [];
    const studyGroups = include('study_groups')
      ? await this.prisma.studyGroup.findMany({
          where: { name: { contains: q, mode: 'insensitive' }, status: { in: ['ACTIVE', 'INACTIVE'] } },
          include: { memberships: { where: { personId, status: 'ACTIVE' } } },
          take: 8,
        })
      : [];
    const services = include('services')
      ? await this.prisma.service.findMany({
          where: {
            visibility: { in: ['PUBLIC', 'CAMPUS'] },
            status: { in: ['PUBLISHED', 'AVAILABLE'] },
            // A paused or unverified provider's services drop out of search the
            // same way they drop out of the catalogue.
            provider: { status: 'ACTIVE' },
            OR: [
              { title: { contains: q, mode: 'insensitive' } },
              { summary: { contains: q, mode: 'insensitive' } },
            ],
          },
          take: 8,
        })
      : [];

    const visiblePeople = await this.visiblePeople(personId, people);

    const visibleResources: SearchHit[] = [];
    for (const resource of resources as Array<{
      id: string;
      title: string;
      visibility: string;
      courseOfferingId: string;
      uploadedById: string;
      status: string;
      course: { code: string };
      courseOffering: { status: string; semester: { label: string } };
    }>) {
      if (await this.access.canViewResource(personId, resource)) {
        visibleResources.push({
          id: resource.id,
          objectType: 'RESOURCE',
          title: resource.title,
          subtitle: `${resource.course.code} · ${resource.courseOffering.semester.label}`,
          route: `/app/learn/resource/${resource.id}`,
          historical: resource.courseOffering.status === 'ARCHIVED',
        });
      }
    }

    const visibleGroups = (studyGroups as Array<{
      id: string;
      name: string;
      memberCount: number;
      visibility: string;
      courseOfferingId: string | null;
      memberships: unknown[];
    }>).filter((group) =>
      canIncludeStudyGroup({
        visibility: group.visibility,
        courseOfferingId: group.courseOfferingId,
        isMember: group.memberships.length > 0,
        enrolledOfferingIds,
        campusMember: true,
      }),
    );

    const items = rankSearchHits(q, [
      ...visiblePeople.map((item) => ({
        id: item.id,
        objectType: 'PERSON',
        title: item.displayName ?? item.username ?? 'Student',
        subtitle: item.bio,
        route: `/app/profile/${item.id}`,
      })),
      ...(courses as Array<{
        id: string;
        code: string;
        title: string;
        department: string | null;
        offerings: Array<{ id: string; semester: { label: string } }>;
      }>).map((item) => {
        const current = item.offerings[0];
        return {
          id: item.id,
          objectType: 'COURSE',
          title: `${item.code} ${item.title}`,
          subtitle: current ? current.semester.label : item.department,
          route: current ? `/app/learn/course/${current.id}` : `/app/learn`,
        };
      }),
      ...(classes as Array<{ id: string; code: string; name: string }>).map((item) => ({
        id: item.id,
        objectType: 'CLASS',
        title: item.code,
        subtitle: item.name,
        route: `/app/class/${item.id}`,
      })),
      ...(organizations as Array<{ id: string; name: string; description: string | null }>).map((item) => ({
        id: item.id,
        objectType: 'ORGANIZATION',
        title: item.name,
        subtitle: item.description,
        route: `/app/explore/organization/${item.id}`,
      })),
      ...(events as Array<{ id: string; title: string; location: string | null }>).map((item) => ({
        id: item.id,
        objectType: 'EVENT',
        title: item.title,
        subtitle: item.location,
        route: `/app/explore/event/${item.id}`,
      })),
      ...visibleResources,
      ...visibleGroups.map((item) => ({
        id: item.id,
        objectType: 'STUDY_GROUP',
        title: item.name,
        subtitle: `${item.memberCount} members`,
        route: `/app/learn/study-group/${item.id}`,
      })),
      ...(services as Array<{ id: string; title: string; summary: string | null }>).map((item) => ({
        id: item.id,
        objectType: 'SERVICE',
        title: item.title,
        subtitle: item.summary,
        route: `/app/explore/service/${item.id}`,
      })),
    ]).slice(0, limit).map((hit) => ({
      ...hit,
      kindLabel: objectTypeLabel(hit.objectType),
    }));

    return { items, scope: 'LIVE' };
  }

  /**
   * People results are filtered, not ranked differently: anyone involved in a
   * block with the viewer, and anyone who has turned off `findable`, drops out.
   * A missing PrivacySettings row means the person never changed the default,
   * which is findable. The viewer can always find themselves.
   */
  private async visiblePeople<
    T extends { id: string; displayName: string | null; username: string | null; bio: string | null },
  >(personId: string, people: T[]): Promise<T[]> {
    if (!people.length) {
      return people;
    }
    const ids = people.map((person) => person.id);
    const [blocks, privacy] = await Promise.all([
      this.prisma.userBlock.findMany({
        where: {
          OR: [
            { blockerId: personId, blockedId: { in: ids } },
            { blockedId: personId, blockerId: { in: ids } },
          ],
        },
        select: { blockerId: true, blockedId: true },
      }),
      this.prisma.privacySettings.findMany({
        where: { personId: { in: ids } },
        select: { personId: true, findable: true },
      }),
    ]);
    const findable = new Map(privacy.map((row) => [row.personId, row.findable]));
    return people.filter((person) =>
      canAppearInPeopleSearch({
        targetId: person.id,
        viewerId: personId,
        findable: findable.get(person.id) ?? DEFAULT_PRIVACY.findable,
        blocked: isBlocked(blocks, personId, person.id),
      }),
    );
  }

  async recent(personId: string) {
    const items = await this.prisma.searchHistory.findMany({
      where: { personId },
      orderBy: { createdAt: 'desc' },
      take: 8,
    });
    const unique: { id: string; query: string }[] = [];
    for (const item of items as Array<{ id: string; query: string }>) {
      if (!unique.some((existing) => existing.query === item.query)) {
        unique.push({ id: item.id, query: item.query });
      }
    }
    return { items: unique };
  }
}
