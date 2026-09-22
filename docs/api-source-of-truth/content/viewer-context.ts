import { PrismaService } from '../prisma/prisma.service';
import { ViewerContext } from './feed-query';

export async function loadViewerContext(prisma: PrismaService, personId: string): Promise<ViewerContext> {
  const [classes, enrollments, memberships, follows, orgFollows, blocks, studyGroups, connections] =
    await Promise.all([
      prisma.classMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { classId: true },
      }),
      prisma.enrollment.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { courseOfferingId: true },
      }),
      prisma.organizationMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { organizationId: true },
      }),
      prisma.followRelationship.findMany({
        where: { followerId: personId, status: 'FOLLOWING' },
        select: { followedId: true },
      }).catch(() => [] as { followedId: string }[]),
      prisma.organizationFollow.findMany({
        where: { personId },
        select: { organizationId: true },
      }),
      prisma.userBlock.findMany({
        where: { blockerId: personId },
        select: { blockedId: true },
      }),
      prisma.studyGroupMembership.findMany({
        where: { personId, status: 'ACTIVE' },
        select: { studyGroupId: true },
      }).catch(() => [] as { studyGroupId: string }[]),
      prisma.connectionRelationship.findMany({
        where: {
          status: 'ACCEPTED',
          OR: [{ personLowId: personId }, { personHighId: personId }],
        },
        select: { personLowId: true, personHighId: true },
      }).catch(() => [] as { personLowId: string; personHighId: string }[]),
    ]);

  return {
    personId,
    classIds: classes.map((row) => row.classId),
    courseIds: enrollments.map((row) => row.courseOfferingId),
    organizationIds: memberships.map((row) => row.organizationId),
    studyGroupIds: studyGroups.map((row) => row.studyGroupId),
    followedPersonIds: follows.map((row) => row.followedId),
    connectedPersonIds: connections.map((row) => (row.personLowId === personId ? row.personHighId : row.personLowId)),
    followedOrganizationIds: orgFollows.map((row) => row.organizationId),
    blockedPersonIds: blocks.map((row) => row.blockedId),
  };
}
