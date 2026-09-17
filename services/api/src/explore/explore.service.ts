import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { formatPrice } from '../campus-services/service-rules';

@Injectable()
export class ExploreService {
  constructor(private readonly prisma: PrismaService) {}

  async getExplore(personId: string) {
    const now = new Date();
    const [types, organizations, events, services, serviceCategories, happening] =
      await Promise.all([
      this.prisma.organizationType.findMany({ orderBy: { label: 'asc' } }),
      this.prisma.organization.findMany({
        where: { status: 'ACTIVE', visibility: 'PUBLIC' },
        include: { type: true },
        orderBy: { memberCount: 'desc' },
        take: 12,
      }),
      this.prisma.campusEvent.findMany({
        where: { visibility: { in: ['PUBLIC', 'CAMPUS_ONLY'] }, startsAt: { gte: now }, status: { in: ['PUBLISHED', 'ONGOING'] } },
        include: { organization: true },
        orderBy: { startsAt: 'asc' },
        take: 8,
      }),
      this.prisma.service.findMany({
        where: {
          visibility: { in: ['PUBLIC', 'CAMPUS'] },
          status: { in: ['PUBLISHED', 'AVAILABLE'] },
          provider: { status: 'ACTIVE' },
        },
        include: { category: true, provider: true },
        orderBy: [{ ratingAverage: 'desc' }, { title: 'asc' }],
        take: 6,
      }),
      this.prisma.serviceCategory.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      }),
      this.prisma.activity.findMany({
        where: {
          status: { in: ['SCHEDULED', 'ONGOING'] },
          organizationId: { not: null },
          startTime: { lte: new Date(now.getTime() + 12 * 60 * 60 * 1000) },
          endTime: { gte: now },
        },
        include: { organization: true },
        take: 6,
      }),
    ]);

    const follows = await this.prisma.organizationFollow.findMany({ where: { personId } });
    const followIds = new Set(follows.map((item: { organizationId: string }) => item.organizationId));

    return {
      happeningNow: happening.map((item) => ({
        id: item.id,
        title: item.title,
        subtitle: item.organization?.name ?? item.location,
        startTime: item.startTime.toISOString(),
        route: item.organizationId
          ? `/app/explore/organization/${item.organizationId}`
          : `/app/calendar/activity/${item.id}`,
      })),
      organizationTypes: types.map((item) => ({
        key: item.key,
        label: item.label,
      })),
      organizations: organizations.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        typeKey: item.typeKey,
        typeLabel: item.type?.label ?? item.typeKey,
        memberCount: item.memberCount,
        followerCount: item.followerCount,
        following: followIds.has(item.id),
        status: item.status,
        accessibilityLabel: `${item.name}. ${item.memberCount} members.${followIds.has(item.id) ? ' Followed.' : ''} Open organization.`,
        route: `/app/explore/organization/${item.id}`,
      })),
      events: events.map((item) => ({
        id: item.id,
        title: item.title,
        startsAt: item.startsAt.toISOString(),
        location: item.location,
        organizationName: item.organization?.name,
        route: `/app/explore/event/${item.id}`,
      })),
      services: services.map((item) => ({
        id: item.id,
        name: item.title,
        description: item.summary ?? item.description,
        categoryKey: item.category.key,
        categoryLabel: item.category.label,
        providerName: item.provider.providerName,
        verified: item.provider.verified,
        priceLabel: formatPrice(item),
        ratingAverage: item.ratingAverage,
        ratingCount: item.ratingCount,
        accessibilityLabel: `${item.title}. ${item.category.label}. ${formatPrice(item)}.`,
        route: `/app/explore/service/${item.id}`,
      })),
      serviceCategories: serviceCategories.map((item) => ({
        key: item.key,
        label: item.label,
        route: `/app/explore/services?category=${item.key}`,
      })),
    };
  }
}
