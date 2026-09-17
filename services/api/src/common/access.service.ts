import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type CourseAction =
  | 'VIEW'
  | 'CREATE_ANNOUNCEMENT'
  | 'EDIT_ANNOUNCEMENT'
  | 'PUBLISH_ANNOUNCEMENT'
  | 'ARCHIVE_ANNOUNCEMENT'
  | 'CREATE_RESOURCE'
  | 'EDIT_RESOURCE'
  | 'ENDORSE_RESOURCE'
  | 'VIEW_RESOURCE'
  | 'DOWNLOAD_RESOURCE'
  | 'CREATE_ASSESSMENT'
  | 'EDIT_ASSESSMENT'
  | 'PUBLISH_ASSESSMENT'
  | 'CANCEL_ASSESSMENT'
  | 'ARCHIVE_ASSESSMENT'
  | 'CREATE_LABORATORY'
  | 'EDIT_LABORATORY'
  | 'PUBLISH_LABORATORY'
  | 'CREATE_DISCUSSION'
  | 'REPLY_DISCUSSION'
  | 'CLOSE_DISCUSSION'
  | 'PIN_DISCUSSION'
  | 'CREATE_STUDY_GROUP';

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async courseContext(personId: string, courseOfferingId: string) {
    const offering = await this.prisma.courseOffering.findUnique({
      where: { id: courseOfferingId },
      include: { course: true, semester: true },
    });
    if (!offering) {
      return null;
    }

    const [enrollment, personnel, classRep] = await Promise.all([
      this.prisma.enrollment.findUnique({
        where: { courseOfferingId_personId: { courseOfferingId, personId } },
      }),
      this.prisma.coursePersonnel.findFirst({
        where: { courseOfferingId, personId },
      }),
      this.prisma.classMembership.findFirst({
        where: { personId, status: 'ACTIVE', role: 'CLASS_REPRESENTATIVE' },
      }),
    ]);

    const isLecturer = personnel?.role === 'LECTURER' || personnel?.role === 'COORDINATOR';
    const isTa = personnel?.role === 'TEACHING_ASSISTANT';
    const isEnrolled = enrollment?.status === 'ACTIVE';
    const isRep = Boolean(classRep);

    const permissions = new Set<CourseAction>([]);
    if (isEnrolled || isLecturer || isTa) {
      permissions.add('VIEW');
      permissions.add('VIEW_RESOURCE');
      permissions.add('CREATE_DISCUSSION');
      permissions.add('REPLY_DISCUSSION');
      permissions.add('CREATE_STUDY_GROUP');
    }
    if (isLecturer) {
      permissions.add('CREATE_ANNOUNCEMENT');
      permissions.add('EDIT_ANNOUNCEMENT');
      permissions.add('PUBLISH_ANNOUNCEMENT');
      permissions.add('ARCHIVE_ANNOUNCEMENT');
      permissions.add('CREATE_RESOURCE');
      permissions.add('EDIT_RESOURCE');
      permissions.add('ENDORSE_RESOURCE');
      permissions.add('DOWNLOAD_RESOURCE');
      permissions.add('CREATE_ASSESSMENT');
      permissions.add('EDIT_ASSESSMENT');
      permissions.add('PUBLISH_ASSESSMENT');
      permissions.add('CANCEL_ASSESSMENT');
      permissions.add('ARCHIVE_ASSESSMENT');
      permissions.add('CREATE_LABORATORY');
      permissions.add('EDIT_LABORATORY');
      permissions.add('PUBLISH_LABORATORY');
      permissions.add('CLOSE_DISCUSSION');
      permissions.add('PIN_DISCUSSION');
    }
    if (isRep) {
      permissions.add('VIEW');
      permissions.add('CREATE_ANNOUNCEMENT');
      permissions.add('EDIT_ANNOUNCEMENT');
      permissions.add('PUBLISH_ANNOUNCEMENT');
      permissions.add('CREATE_RESOURCE');
    }
    if (isEnrolled) {
      permissions.add('CREATE_RESOURCE');
    }
    if (personnel?.permissions?.length) {
      for (const permission of personnel.permissions) {
        permissions.add(permission as CourseAction);
      }
    }

    return {
      offering,
      enrollment,
      personnel,
      isLecturer,
      isTa,
      isEnrolled,
      isRep,
      permissions,
      can: (action: CourseAction) => permissions.has(action),
    };
  }

  async canViewResource(personId: string, resource: { visibility: string; courseOfferingId: string; uploadedById: string; status: string }) {
    if (resource.status === 'REMOVED') {
      return false;
    }
    if (resource.uploadedById === personId) {
      return true;
    }
    if (resource.visibility === 'PUBLIC') {
      return true;
    }
    if (resource.visibility === 'AUTHENTICATED_USERS') {
      return true;
    }
    const context = await this.courseContext(personId, resource.courseOfferingId);
    if (!context) {
      return false;
    }
    if (resource.visibility === 'COURSE_MEMBERS') {
      return context.can('VIEW_RESOURCE');
    }
    if (resource.visibility === 'CLASS_MEMBERS') {
      const membership = await this.prisma.classMembership.findFirst({
        where: { personId, status: 'ACTIVE' },
      });
      return Boolean(membership);
    }
    if (resource.visibility === 'PRIVATE') {
      return resource.uploadedById === personId || context.isLecturer;
    }
    return false;
  }

  async canDownloadResource(
    personId: string,
    resource: { visibility: string; courseOfferingId: string; uploadedById: string; status: string },
  ) {
    if (!(await this.canViewResource(personId, resource))) {
      return false;
    }
    if (resource.uploadedById === personId) {
      return true;
    }
    if (resource.visibility === 'PUBLIC') {
      return true;
    }
    const context = await this.courseContext(personId, resource.courseOfferingId);
    return Boolean(context?.can('DOWNLOAD_RESOURCE'));
  }
}
