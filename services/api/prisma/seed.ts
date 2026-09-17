import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  // Deletion order follows the dependency graph: children before parents.
  await prisma.serviceAudit.deleteMany();
  await prisma.moderationReport.deleteMany();
  await prisma.serviceReview.deleteMany();
  await prisma.bookingFile.deleteMany();
  await prisma.bookingStatusHistory.deleteMany();
  await prisma.bookingFieldValue.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.serviceAvailabilityException.deleteMany();
  await prisma.serviceAvailabilityRule.deleteMany();
  await prisma.serviceBookingField.deleteMany();
  await prisma.service.deleteMany();
  await prisma.serviceLocation.deleteMany();
  await prisma.serviceProviderVerification.deleteMany();
  await prisma.serviceProviderProfile.deleteMany();
  await prisma.serviceCategory.deleteMany();
  await prisma.usernameChange.deleteMany();
  await prisma.socialAudit.deleteMany();
  await prisma.savedObject.deleteMany();
  await prisma.privacySettings.deleteMany();
  await prisma.connectionRelationship.deleteMany();
  await prisma.followRelationship.deleteMany();
  await prisma.userBlock.deleteMany();
  await prisma.notificationDelivery.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.device.deleteMany();
  await prisma.messageReadState.deleteMany();
  await prisma.messageSharedObject.deleteMany();
  await prisma.messageMention.deleteMany();
  await prisma.messageReaction.deleteMany();
  await prisma.conversationMute.deleteMany();
  await prisma.conversationParticipant.deleteMany();
  await prisma.activityReminder.deleteMany();
  await prisma.eventResponse.deleteMany();
  await prisma.eventAudit.deleteMany();
  await prisma.organizationNotificationSetting.deleteMany();
  await prisma.organizationPostAttachment.deleteMany();
  await prisma.organizationPost.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.postReaction.deleteMany();
  await prisma.postMention.deleteMany();
  await prisma.postAttachment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.fileAccessRecord.deleteMany();
  await prisma.organizationInvitation.deleteMany();
  await prisma.organizationApproval.deleteMany();
  await prisma.organizationFollow.deleteMany();
  await prisma.organizationMembership.deleteMany();
  await prisma.discussionMention.deleteMany();
  await prisma.discussionAttachment.deleteMany();
  await prisma.discussionReply.deleteMany();
  await prisma.discussion.deleteMany();
  await prisma.laboratoryResource.deleteMany();
  await prisma.assessmentAuditEvent.deleteMany();
  await prisma.assessmentResource.deleteMany();
  await prisma.message.deleteMany();
  await prisma.studyGroupMembership.deleteMany();
  await prisma.studyGroupCourse.deleteMany();
  await prisma.attentionItem.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.searchHistory.deleteMany();
  await prisma.announcementRead.deleteMany();
  await prisma.resourceRelationship.deleteMany();
  await prisma.resourceEndorsement.deleteMany();
  await prisma.resourceVersion.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.fileObject.deleteMany();
  await prisma.activity.deleteMany();
  await prisma.studyGroup.deleteMany();
  await prisma.campusEvent.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.organizationType.deleteMany();
  await prisma.laboratoryActivity.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.coursePersonnel.deleteMany();
  await prisma.classMembership.deleteMany();
  await prisma.studentVerification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.resourceCategory.deleteMany();
  await prisma.courseOffering.deleteMany();
  await prisma.course.deleteMany();
  await prisma.academicClass.deleteMany();
  await prisma.academicSemester.deleteMany();
  await prisma.programme.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.otpChallenge.deleteMany();
  await prisma.otpRateLimit.deleteMany();
  await prisma.person.deleteMany();

  const faculty = await prisma.faculty.create({
    data: { id: 'faculty_eng', code: 'ENG', name: 'Faculty of Engineering' },
  });

  const programme = await prisma.programme.create({
    data: {
      id: 'programme_bsceee',
      code: 'BScEEE',
      name: 'Bachelor of Science in Electrical Engineering',
      facultyId: faculty.id,
    },
  });

  const s2025 = await prisma.academicSemester.create({
    data: {
      id: 'semester_2025_s2',
      label: '2025 Semester 2',
      year: 2025,
      term: 2,
      startsAt: new Date('2025-08-01'),
      endsAt: new Date('2025-12-15'),
    },
  });
  const s2026 = await prisma.academicSemester.create({
    data: {
      id: 'semester_2026_s2',
      label: '2026 Semester 2',
      year: 2026,
      term: 2,
      startsAt: new Date('2026-08-03'),
      endsAt: new Date('2026-12-12'),
    },
  });

  const course = await prisma.course.create({
    data: {
      id: 'course_eeng401',
      code: 'EENG401',
      title: 'Control Systems',
      facultyId: faculty.id,
      department: 'Electrical Engineering',
    },
  });

  const historicalOffering = await prisma.courseOffering.create({
    data: {
      id: 'coe-2025-s2-eeng401',
      courseId: course.id,
      semesterId: s2025.id,
      status: 'ARCHIVED',
      description: 'Archived 2025 offering of Control Systems.',
      learningOutcomes: ['Model dynamic systems', 'Analyse stability'],
      outline: ['Introduction', 'Modelling', 'Stability'],
      references: ['Nise, Control Systems Engineering'],
    },
  });

  const offering = await prisma.courseOffering.create({
    data: {
      id: 'coe-2026-s2-eeng401',
      courseId: course.id,
      semesterId: s2026.id,
      status: 'ACTIVE',
      description:
        'This course introduces modelling, stability analysis and control design for linear systems.',
      learningOutcomes: [
        'Understand transfer functions and block diagrams',
        'Analyse stability using Routh-Hurwitz and Nyquist',
        'Design lead, lag and PID controllers',
      ],
      outline: ['Introduction', 'Modelling', 'Stability', 'Control design'],
      references: ['Nise, Control Systems Engineering', 'Ogata, Modern Control Engineering'],
    },
  });

  const moyo = await prisma.person.create({
    data: {
      id: 'person_moyo',
      phoneNumber: '+263771000001',
      givenName: 'John',
      familyName: 'Moyo',
      displayName: 'Dr John Moyo',
      username: 'jmoyo',
      bio: 'Senior Lecturer, Electrical Engineering',
      accountState: 'ACTIVE',
    },
  });
  const jane = await prisma.person.create({
    data: {
      id: 'person_jane',
      phoneNumber: '+263771000002',
      givenName: 'Jane',
      familyName: 'Smith',
      displayName: 'Jane Smith',
      username: 'jsmith',
      accountState: 'ACTIVE',
    },
  });
  const tawanda = await prisma.person.create({
    data: {
      id: 'person_tawanda',
      phoneNumber: '+263771000003',
      givenName: 'Tawanda',
      familyName: 'Moyo',
      displayName: 'Tawanda M.',
      username: 'tawanda',
      accountState: 'ACTIVE',
    },
  });
  const rep = await prisma.person.create({
    data: {
      id: 'person_rep',
      phoneNumber: '+263771000004',
      givenName: 'Rudo',
      familyName: 'Ncube',
      displayName: 'Rudo Ncube',
      username: 'rudo',
      accountState: 'ACTIVE',
    },
  });
  const matthew = await prisma.person.create({
    data: {
      id: 'person_matthew',
      phoneNumber: '+263771234567',
      givenName: 'Matthew',
      familyName: 'Dziirutsva',
      displayName: 'Matthew Dziirutsva',
      username: 'matthew',
      bio: 'Electrical Engineering',
      accountState: 'ACTIVE',
    },
  });

  await prisma.studentVerification.create({
    data: {
      id: 'stuv_matthew',
      personId: matthew.id,
      registrationNumber: 'R123456A',
      programmeId: programme.id,
      facultyId: faculty.id,
      status: 'APPROVED',
    },
  });

  await prisma.coursePersonnel.createMany({
    data: [
      {
        id: 'cp_moyo',
        courseOfferingId: offering.id,
        personId: moyo.id,
        role: 'LECTURER',
        permissions: ['VIEW', 'CREATE_ANNOUNCEMENT', 'CREATE_RESOURCE', 'ENDORSE_RESOURCE'],
      },
      {
        id: 'cp_jane',
        courseOfferingId: offering.id,
        personId: jane.id,
        role: 'TEACHING_ASSISTANT',
        permissions: ['VIEW'],
      },
    ],
  });

  await prisma.enrollment.createMany({
    data: [
      { id: 'en_matthew', courseOfferingId: offering.id, personId: matthew.id, status: 'ACTIVE' },
      { id: 'en_tawanda', courseOfferingId: offering.id, personId: tawanda.id, status: 'ACTIVE' },
      { id: 'en_rep', courseOfferingId: offering.id, personId: rep.id, status: 'ACTIVE' },
    ],
  });

  const academicClass = await prisma.academicClass.create({
    data: {
      id: 'class_eee41',
      code: 'EEE 4.1',
      name: 'Electrical Engineering',
      yearOfStudy: 4,
      facultyName: 'Engineering',
      semesterId: s2026.id,
    },
  });

  await prisma.classMembership.createMany({
    data: [
      {
        id: 'cm_rep',
        classId: academicClass.id,
        personId: rep.id,
        role: 'CLASS_REPRESENTATIVE',
        status: 'ACTIVE',
      },
      {
        id: 'cm_matthew',
        classId: academicClass.id,
        personId: matthew.id,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
      {
        id: 'cm_tawanda',
        classId: academicClass.id,
        personId: tawanda.id,
        role: 'MEMBER',
        status: 'ACTIVE',
      },
    ],
  });

  const now = new Date();
  const lectureStart = new Date(now.getTime() + 35 * 60 * 1000);
  const lectureEnd = new Date(lectureStart.getTime() + 60 * 60 * 1000);
  const labStart = new Date(now);
  labStart.setHours(11, 0, 0, 0);
  const assignmentDue = new Date(now);
  assignmentDue.setHours(14, 0, 0, 0);

  await prisma.activity.createMany({
    data: [
      {
        id: 'activity_lecture',
        type: 'LECTURE',
        title: 'Control Systems Lecture',
        startTime: lectureStart,
        endTime: lectureEnd,
        location: 'Engineering Block A',
        status: 'SCHEDULED',
        relevanceWeight: 80,
        courseOfferingId: offering.id,
        classId: academicClass.id,
      },
      {
        id: 'activity_lab',
        type: 'LABORATORY',
        title: 'Control Systems Lab',
        startTime: labStart,
        endTime: new Date(labStart.getTime() + 2 * 60 * 60 * 1000),
        location: 'Machines Lab',
        status: 'SCHEDULED',
        relevanceWeight: 70,
        courseOfferingId: offering.id,
      },
      {
        id: 'activity_assignment',
        type: 'ASSIGNMENT_DEADLINE',
        title: 'Assignment deadline',
        startTime: assignmentDue,
        endTime: assignmentDue,
        status: 'SCHEDULED',
        relevanceWeight: 90,
        courseOfferingId: offering.id,
      },
    ],
  });

  const announcement = await prisma.announcement.create({
    data: {
      id: 'ann_test',
      courseOfferingId: offering.id,
      authorId: moyo.id,
      title: 'Control Systems Test',
      body: 'The first class test will be held on Thursday at 10:00.\n\nTopics:\n• Transfer functions\n• Block diagrams\n• Stability',
      priority: 'IMPORTANT',
      status: 'PUBLISHED',
      publishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
    },
  });

  await prisma.notification.create({
    data: {
      id: 'ntf_ann',
      personId: matthew.id,
      type: 'IMPORTANT_ANNOUNCEMENT',
      category: 'ACADEMIC',
      title: 'Control Systems Test',
      body: 'New Control Systems announcement',
      sourceType: 'ANNOUNCEMENT',
      sourceId: announcement.id,
      announcementId: announcement.id,
      deepLink: `/app/learn/announcement/${announcement.id}`,
      priority: 'HIGH',
      status: 'DELIVERED',
      deliveredAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      idempotencyKey: `${announcement.id}:${matthew.id}:IMPORTANT_ANNOUNCEMENT`,
    },
  });

  const categories = [
    { id: 'cat_notes', key: 'LECTURE_NOTES', label: 'Lecture Notes', groupKey: 'OFFICIAL', groupLabel: 'Official Course Resources', sortOrder: 1 },
    { id: 'cat_slides', key: 'SLIDES', label: 'Slides', groupKey: 'OFFICIAL', groupLabel: 'Official Course Resources', sortOrder: 2 },
    { id: 'cat_tutorials', key: 'TUTORIAL', label: 'Tutorials', groupKey: 'OFFICIAL', groupLabel: 'Official Course Resources', sortOrder: 3 },
    { id: 'cat_labs', key: 'LAB_MANUAL', label: 'Laboratory Manuals', groupKey: 'OFFICIAL', groupLabel: 'Official Course Resources', sortOrder: 4 },
    { id: 'cat_student_notes', key: 'STUDENT_NOTES', label: 'Student Notes', groupKey: 'STUDENT', groupLabel: 'Student Resources', sortOrder: 10 },
    { id: 'cat_study_guides', key: 'STUDY_GUIDE', label: 'Study Guides', groupKey: 'STUDENT', groupLabel: 'Student Resources', sortOrder: 11 },
    { id: 'cat_past_exam', key: 'PAST_EXAM', label: 'Past Papers', groupKey: 'HISTORICAL', groupLabel: 'Historical Resources', sortOrder: 20 },
  ];
  await prisma.resourceCategory.createMany({ data: categories });

  const uploads = join(process.cwd(), 'uploads');
  await mkdir(uploads, { recursive: true });

  async function seedFile(id: string, name: string, uploaderId: string, body: string) {
    const storageKey = join(uploads, id);
    await writeFile(storageKey, body);
    return prisma.fileObject.create({
      data: {
        id,
        uploaderId,
        originalName: name,
        mimeType: 'application/pdf',
        sizeBytes: Buffer.byteLength(body),
        checksumSha256: sha256(body),
        storageKey,
        processingState: 'READY',
        lifecycleState: 'AVAILABLE',
        securityClass: 'AUTHENTICATED',
        uploadContext: 'RESOURCE',
      },
    });
  }

  const lectureFile = await seedFile('file_lecture05', 'Lecture 05 — Root Locus.pdf', moyo.id, '%PDF-1.4 CampusOS lecture 05 root locus');
  const tutorialFile = await seedFile('file_tutorial2', 'Control Systems Tutorial 2.pdf', moyo.id, '%PDF-1.4 CampusOS tutorial 2');
  const studyFile = await seedFile('file_study', 'EENG401 Study Guide.pdf', tawanda.id, '%PDF-1.4 CampusOS study guide');
  const examFile = await seedFile('file_exam2025', 'EENG401 Final Examination 2025.pdf', moyo.id, '%PDF-1.4 CampusOS 2025 exam');
  const solutionFile = await seedFile('file_exam_sol', 'EENG401 Final Exam Official Solution.pdf', moyo.id, '%PDF-1.4 CampusOS 2025 solution');

  const lectureResource = await prisma.resource.create({
    data: {
      id: 'res-lecture-05',
      courseId: course.id,
      courseOfferingId: offering.id,
      title: 'Lecture 05 — Root Locus',
      description: 'Root locus construction and interpretation.',
      resourceType: 'LECTURE_NOTES',
      categoryId: 'cat_notes',
      visibility: 'COURSE_MEMBERS',
      status: 'PUBLISHED',
      uploadedById: moyo.id,
      authoredById: moyo.id,
      academicYear: 2026,
      semesterLabel: '2026 Semester 2',
      publishedAt: now,
      editableUntil: new Date(now.getTime() + 45 * 60 * 1000),
    },
  });
  const lectureVersion = await prisma.resourceVersion.create({
    data: {
      id: 'rver_lecture_v1',
      resourceId: lectureResource.id,
      versionNumber: 1,
      fileId: lectureFile.id,
      uploadedById: moyo.id,
      changeSummary: 'Initial upload',
      checksum: lectureFile.checksumSha256,
      status: 'CURRENT',
    },
  });
  await prisma.resource.update({
    where: { id: lectureResource.id },
    data: { currentVersionId: lectureVersion.id },
  });

  const tutorialResource = await prisma.resource.create({
    data: {
      id: 'res-tutorial-3',
      courseId: course.id,
      courseOfferingId: offering.id,
      title: 'EENG401 Tutorial 3',
      description: 'Root locus tutorial',
      resourceType: 'TUTORIAL',
      categoryId: 'cat_tutorials',
      visibility: 'COURSE_MEMBERS',
      status: 'PUBLISHED',
      uploadedById: tawanda.id,
      authoredById: tawanda.id,
      academicYear: 2026,
      semesterLabel: '2026 Semester 2',
      publishedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
      editableUntil: new Date(now.getTime() - 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
    },
  });
  const tutorialV1 = await prisma.resourceVersion.create({
    data: {
      id: 'rver_tutorial_v1',
      resourceId: tutorialResource.id,
      versionNumber: 1,
      fileId: tutorialFile.id,
      uploadedById: tawanda.id,
      changeSummary: 'Initial upload',
      checksum: tutorialFile.checksumSha256,
      status: 'SUPERSEDED',
      createdAt: new Date('2026-09-10'),
    },
  });
  const tutorialV2 = await prisma.resourceVersion.create({
    data: {
      id: 'rver_tutorial_v2',
      resourceId: tutorialResource.id,
      versionNumber: 2,
      fileId: tutorialFile.id,
      uploadedById: tawanda.id,
      changeSummary: 'Corrected equation',
      checksum: tutorialFile.checksumSha256,
      status: 'CURRENT',
      createdAt: new Date('2026-09-11'),
    },
  });
  await prisma.resource.update({
    where: { id: tutorialResource.id },
    data: { currentVersionId: tutorialV2.id },
  });
  await prisma.resourceEndorsement.create({
    data: {
      id: 'rend_tutorial',
      resourceId: tutorialResource.id,
      endorserId: moyo.id,
      endorsementType: 'ENDORSED',
      comment: 'Verified this resource as useful for EENG401.',
    },
  });

  const studyResource = await prisma.resource.create({
    data: {
      id: 'res-study-guide',
      courseId: course.id,
      courseOfferingId: offering.id,
      title: 'EENG401 Study Guide',
      resourceType: 'STUDY_GUIDE',
      categoryId: 'cat_study_guides',
      visibility: 'COURSE_MEMBERS',
      status: 'PUBLISHED',
      uploadedById: tawanda.id,
      authoredById: tawanda.id,
      academicYear: 2026,
      semesterLabel: '2026 Semester 2',
      publishedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      editableUntil: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000),
    },
  });
  const studyVersion = await prisma.resourceVersion.create({
    data: {
      id: 'rver_study_v1',
      resourceId: studyResource.id,
      versionNumber: 1,
      fileId: studyFile.id,
      uploadedById: tawanda.id,
      checksum: studyFile.checksumSha256,
      status: 'CURRENT',
    },
  });
  await prisma.resource.update({
    where: { id: studyResource.id },
    data: { currentVersionId: studyVersion.id },
  });

  const examResource = await prisma.resource.create({
    data: {
      id: 'res-exam-2025',
      courseId: course.id,
      courseOfferingId: historicalOffering.id,
      title: 'EENG401 Final Examination',
      description: 'Past examination paper. No solution attached originally.',
      resourceType: 'PAST_EXAM',
      categoryId: 'cat_past_exam',
      visibility: 'COURSE_MEMBERS',
      status: 'PUBLISHED',
      uploadedById: moyo.id,
      authoredById: moyo.id,
      academicYear: 2025,
      semesterLabel: '2025 Semester 2',
      publishedAt: new Date('2025-12-01'),
      editableUntil: new Date('2025-12-01T00:45:00Z'),
    },
  });
  const examVersion = await prisma.resourceVersion.create({
    data: {
      id: 'rver_exam_v1',
      resourceId: examResource.id,
      versionNumber: 1,
      fileId: examFile.id,
      uploadedById: moyo.id,
      checksum: examFile.checksumSha256,
      status: 'CURRENT',
    },
  });
  await prisma.resource.update({
    where: { id: examResource.id },
    data: { currentVersionId: examVersion.id },
  });

  const solutionResource = await prisma.resource.create({
    data: {
      id: 'res-exam-sol-2025',
      courseId: course.id,
      courseOfferingId: historicalOffering.id,
      title: '2025 EENG401 Final Exam Official Solution',
      resourceType: 'SOLUTION',
      categoryId: 'cat_past_exam',
      visibility: 'COURSE_MEMBERS',
      status: 'PUBLISHED',
      uploadedById: moyo.id,
      authoredById: moyo.id,
      academicYear: 2025,
      semesterLabel: '2025 Semester 2',
      solutionAvailable: true,
      publishedAt: new Date('2025-12-08'),
      editableUntil: new Date('2025-12-08T00:45:00Z'),
    },
  });
  const solVersion = await prisma.resourceVersion.create({
    data: {
      id: 'rver_sol_v1',
      resourceId: solutionResource.id,
      versionNumber: 1,
      fileId: solutionFile.id,
      uploadedById: moyo.id,
      checksum: solutionFile.checksumSha256,
      status: 'CURRENT',
    },
  });
  await prisma.resource.update({
    where: { id: solutionResource.id },
    data: { currentVersionId: solVersion.id },
  });
  await prisma.resourceRelationship.create({
    data: {
      id: 'rrel_exam_sol',
      fromResourceId: examResource.id,
      toResourceId: solutionResource.id,
      type: 'SOLUTION_TO',
    },
  });

  await prisma.studyGroup.createMany({
    data: [
      {
        id: 'sg_pe',
        name: 'Power Electronics Revision',
        courseOfferingId: offering.id,
        createdById: tawanda.id,
        memberCount: 12,
      },
      {
        id: 'sg_cs',
        name: 'Control Systems Weekend Group',
        courseOfferingId: offering.id,
        createdById: matthew.id,
        memberCount: 8,
      },
    ],
  });

  const typeRows = [
    ['ACADEMIC', 'Academic'],
    ['PROFESSIONAL', 'Professional'],
    ['RELIGIOUS', 'Religious'],
    ['SPORTS', 'Sports'],
    ['CULTURAL', 'Cultural'],
    ['SOCIAL', 'Social'],
    ['RESIDENCE', 'Residence'],
    ['STUDENT_ASSOCIATION', 'Student Association'],
    ['POLITICAL', 'Political'],
    ['VOLUNTEER', 'Volunteer'],
    ['INTEREST', 'Interest'],
    ['OTHER', 'Other'],
  ] as const;
  await prisma.organizationType.createMany({
    data: typeRows.map(([key, label]) => ({ id: `otype_${key.toLowerCase()}`, key, label })),
  });

  const interestType = await prisma.organizationType.findUnique({ where: { key: 'INTEREST' } });
  const academicType = await prisma.organizationType.findUnique({ where: { key: 'ACADEMIC' } });
  const religiousType = await prisma.organizationType.findUnique({ where: { key: 'RELIGIOUS' } });

  const chessConv = await prisma.conversation.create({
    data: { id: 'conv_chess', kind: 'ORGANIZATION', title: 'UZ Chess Society', createdById: tawanda.id },
  });
  const chess = await prisma.organization.create({
    data: {
      id: 'org_chess',
      name: 'UZ Chess Society',
      description: 'The UZ Chess Society brings together students interested in chess.',
      typeKey: 'INTEREST',
      typeId: interestType?.id,
      status: 'ACTIVE',
      membershipPolicy: 'OPEN',
      createdById: tawanda.id,
      conversationId: chessConv.id,
      memberCount: 3,
      followerCount: 1,
    },
  });
  const engsoc = await prisma.organization.create({
    data: {
      id: 'org_engsoc',
      name: 'Engineering Society',
      description: 'Faculty society for engineering students.',
      typeKey: 'ACADEMIC',
      typeId: academicType?.id,
      status: 'ACTIVE',
      membershipPolicy: 'REQUEST_TO_JOIN',
      createdById: moyo.id,
      memberCount: 2,
    },
  });
  await prisma.organization.create({
    data: {
      id: 'org_sda',
      name: 'Southgate South SDA',
      description: 'Campus religious community.',
      typeKey: 'RELIGIOUS',
      typeId: religiousType?.id,
      status: 'ACTIVE',
      createdById: rep.id,
      followerCount: 420,
      memberCount: 160,
    },
  });

  await prisma.organizationMembership.createMany({
    data: [
      { id: 'orgm_tawanda', organizationId: chess.id, personId: tawanda.id, role: 'ADMIN', officerTitle: 'President', status: 'ACTIVE' },
      { id: 'orgm_rudo', organizationId: chess.id, personId: rep.id, role: 'OFFICER', officerTitle: 'Secretary', status: 'ACTIVE' },
      { id: 'orgm_matthew_chess', organizationId: chess.id, personId: matthew.id, role: 'MEMBER', status: 'ACTIVE' },
      { id: 'orgm_moyo_eng', organizationId: engsoc.id, personId: moyo.id, role: 'ADMIN', officerTitle: 'Patron', status: 'ACTIVE' },
      { id: 'orgm_matthew_eng', organizationId: engsoc.id, personId: matthew.id, role: 'MEMBER', status: 'ACTIVE' },
    ],
  });
  await prisma.organizationFollow.create({
    data: { id: 'orgf_matthew_chess', organizationId: chess.id, personId: matthew.id },
  });
  await prisma.post.create({
    data: {
      id: 'orgp_welcome',
      organizationId: chess.id,
      contextType: 'ORGANIZATION',
      contextId: chess.id,
      authorId: tawanda.id,
      body: 'New members welcome. Training tonight at 16:00.',
      kind: 'POST',
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: now,
    },
  });

  const venue = await prisma.venue.create({
    data: {
      id: 'venue_eng_block',
      name: 'Engineering Block',
      building: 'Engineering Block',
      room: 'Exhibition Hall',
      address: 'University of Zimbabwe',
    },
  });

  const expoStart = new Date('2026-09-19T08:00:00.000Z');
  const expoEnd = new Date('2026-09-19T14:00:00.000Z');
  const expo = await prisma.campusEvent.create({
    data: {
      id: 'event_expo',
      title: 'Engineering Expo 2026',
      description: 'Faculty-wide exhibition of student and society projects.',
      eventType: 'ACADEMIC',
      status: 'PUBLISHED',
      organizerType: 'ORGANIZATION',
      organizerId: engsoc.id,
      organizationId: engsoc.id,
      createdById: moyo.id,
      visibility: 'CAMPUS_ONLY',
      participationPolicy: 'OPEN',
      capacity: 100,
      venueId: venue.id,
      location: 'Engineering Block',
      startsAt: expoStart,
      endsAt: expoEnd,
      timezone: 'Africa/Harare',
      publishedAt: now,
      participantVisibility: 'COUNT_ONLY',
    },
  });
  const expoActivity = await prisma.activity.create({
    data: {
      id: 'activity_expo',
      type: 'EVENT',
      title: 'Engineering Expo 2026',
      startTime: expoStart,
      endTime: expoEnd,
      location: 'Engineering Block',
      status: 'SCHEDULED',
      relevanceWeight: 70,
      sourceType: 'EVENT',
      sourceId: expo.id,
      organizerType: 'ORGANIZATION',
      organizerId: engsoc.id,
      visibility: 'CAMPUS_ONLY',
      organizationId: engsoc.id,
      eventId: expo.id,
      timezone: 'Africa/Harare',
    },
  });
  await prisma.campusEvent.update({
    where: { id: expo.id },
    data: { activityId: expoActivity.id },
  });
  await prisma.eventResponse.create({
    data: { id: 'ersp_matthew_expo', eventId: expo.id, personId: matthew.id, response: 'GOING' },
  });

  await prisma.campusEvent.create({
    data: {
      id: 'event_chess',
      organizationId: chess.id,
      organizerType: 'ORGANIZATION',
      organizerId: chess.id,
      createdById: tawanda.id,
      title: 'Chess Training Session',
      eventType: 'SPORT',
      status: 'PUBLISHED',
      startsAt: new Date(now.getTime() + 6 * 60 * 60 * 1000),
      location: 'Student Centre',
      visibility: 'PUBLIC',
      publishedAt: now,
    },
  });

  await prisma.assessment.create({
    data: {
      id: 'asm_assignment_2',
      courseOfferingId: offering.id,
      title: 'Control Systems Assignment 2',
      assessmentType: 'ASSIGNMENT',
      status: 'PUBLISHED',
      dueAt: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      timezone: 'Africa/Harare',
      weight: 10,
      instructions: 'Design a feedback controller for the plant discussed in Lecture 4.',
      submissionMode: 'EXTERNAL',
      externalSubmissionUrl: 'https://elearning.uz.ac.zw/eeng401/assignment-2',
      createdById: moyo.id,
      publishedAt: now,
    },
  });
  await prisma.laboratoryActivity.create({
    data: {
      id: 'lab_4',
      courseOfferingId: offering.id,
      title: 'Lab 4',
      description: 'DC Motor Speed Control',
      objective: 'Investigate closed-loop speed control of a DC motor.',
      location: 'Electrical Machines Laboratory',
      startAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      endAt: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      status: 'PUBLISHED',
      instructions: '1. Connect the motor.\n2. Measure speed.\n3. Record results.',
      safetyLevel: 'HIGH',
      safetyInstructions: 'Disconnect the supply before modifying the circuit.',
      hazards: ['Electrical hazard', 'Rotating machinery'],
      equipment: ['DC motor', 'Variable DC supply', 'Tachometer', 'Multimeter'],
      createdById: moyo.id,
    },
  });

  await prisma.attentionItem.createMany({
    data: [
      {
        id: 'att_assignment',
        personId: matthew.id,
        priority: 'HIGH',
        title: 'Assignment due tomorrow',
        subtitle: 'EENG401 · Control Systems',
        actionLabel: 'View assignment',
        sourceType: 'ASSIGNMENT',
        sourceId: 'activity_assignment',
        route: `/app/learn/course/${offering.id}`,
      },
      {
        id: 'att_ann',
        personId: matthew.id,
        priority: 'NORMAL',
        title: 'New class announcement',
        subtitle: 'EEE 4.1',
        actionLabel: 'Read announcement',
        sourceType: 'ANNOUNCEMENT',
        sourceId: announcement.id,
        route: `/app/learn/course/${offering.id}/announcements`,
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Messaging: one universal Conversation engine, so the direct thread between
  // Matthew and Tawanda is the same model the class and service threads use.
  // ---------------------------------------------------------------------------
  const directContextId =
    matthew.id < tawanda.id ? `${matthew.id}:${tawanda.id}` : `${tawanda.id}:${matthew.id}`;
  const directConversation = await prisma.conversation.create({
    data: {
      id: 'conv_matthew_tawanda',
      kind: 'DIRECT',
      contextType: 'DIRECT_PAIR',
      contextId: directContextId,
      createdById: tawanda.id,
      lastActivityAt: new Date(now.getTime() - 20 * 60 * 1000),
      participants: {
        create: [
          { id: 'cpart_direct_matthew', personId: matthew.id },
          { id: 'cpart_direct_tawanda', personId: tawanda.id },
        ],
      },
    },
  });
  await prisma.message.createMany({
    data: [
      {
        id: 'msg_direct_1',
        conversationId: directConversation.id,
        senderId: tawanda.id,
        body: 'Are you coming to the Control Systems revision on Saturday?',
        createdAt: new Date(now.getTime() - 55 * 60 * 1000),
      },
      {
        id: 'msg_direct_2',
        conversationId: directConversation.id,
        senderId: matthew.id,
        body: 'Yes. I still need to finish Assignment 2 first.',
        createdAt: new Date(now.getTime() - 40 * 60 * 1000),
      },
      {
        id: 'msg_direct_3',
        conversationId: directConversation.id,
        senderId: tawanda.id,
        body: 'I uploaded the study guide under Resources if it helps.',
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
      },
    ],
  });
  await prisma.conversation.update({
    where: { id: directConversation.id },
    data: { lastMessageId: 'msg_direct_3' },
  });
  // Tawanda has read to the end; Matthew has one unread message.
  await prisma.messageReadState.createMany({
    data: [
      {
        id: 'mread_direct_tawanda',
        conversationId: directConversation.id,
        personId: tawanda.id,
        lastReadAt: new Date(now.getTime() - 19 * 60 * 1000),
      },
      {
        id: 'mread_direct_matthew',
        conversationId: directConversation.id,
        personId: matthew.id,
        lastReadAt: new Date(now.getTime() - 39 * 60 * 1000),
      },
    ],
  });
  await prisma.conversation.update({
    where: { id: chessConv.id },
    data: { contextType: 'ORGANIZATION', contextId: chess.id },
  });

  // ---------------------------------------------------------------------------
  // Social graph and privacy
  // ---------------------------------------------------------------------------
  await prisma.followRelationship.createMany({
    data: [
      { id: 'flw_matthew_tawanda', followerId: matthew.id, followedId: tawanda.id, status: 'FOLLOWING' },
      { id: 'flw_tawanda_matthew', followerId: tawanda.id, followedId: matthew.id, status: 'FOLLOWING' },
      { id: 'flw_matthew_rudo', followerId: matthew.id, followedId: rep.id, status: 'FOLLOWING' },
      { id: 'flw_matthew_moyo', followerId: matthew.id, followedId: moyo.id, status: 'FOLLOWING' },
    ],
  });
  // ConnectionRelationship stores a canonical low/high person ordering.
  const connectionPair = (a: string, b: string) =>
    a < b ? { personLowId: a, personHighId: b } : { personLowId: b, personHighId: a };
  await prisma.connectionRelationship.createMany({
    data: [
      {
        id: 'cnx_matthew_tawanda',
        ...connectionPair(matthew.id, tawanda.id),
        requesterId: matthew.id,
        addresseeId: tawanda.id,
        status: 'ACCEPTED',
      },
      {
        id: 'cnx_rudo_matthew',
        ...connectionPair(rep.id, matthew.id),
        requesterId: rep.id,
        addresseeId: matthew.id,
        status: 'REQUESTED',
      },
    ],
  });
  await prisma.privacySettings.createMany({
    data: [
      { id: 'priv_matthew', personId: matthew.id },
      { id: 'priv_tawanda', personId: tawanda.id, whoCanMessage: 'CAMPUS' },
      // Jane has opted out of being findable, which people search must respect.
      { id: 'priv_jane', personId: jane.id, findable: false, profileVisibility: 'CONNECTIONS' },
    ],
  });
  await prisma.notificationPreference.create({
    data: { id: 'npref_matthew', personId: matthew.id, quietHoursStart: '22:00', quietHoursEnd: '06:00' },
  });

  // ---------------------------------------------------------------------------
  // Part XVII — campus services. Categories are configuration, not client code.
  // ---------------------------------------------------------------------------
  const categoryRows = [
    ['PRINTING', 'Printing & Copying', 1],
    ['FOOD', 'Food & Catering', 2],
    ['LAUNDRY', 'Laundry', 3],
    ['BEAUTY', 'Beauty & Grooming', 4],
    ['REPAIRS', 'Repairs', 5],
    ['TECHNOLOGY', 'Technology', 6],
    ['DESIGN', 'Design', 7],
    ['PHOTOGRAPHY', 'Photography', 8],
    ['TUTORING', 'Tutoring', 9],
    ['TRANSPORT', 'Transport', 10],
    ['ACCOMMODATION', 'Accommodation', 11],
    ['PERSONAL_SERVICES', 'Personal Services', 12],
    ['OTHER', 'Other', 99],
  ] as const;
  await prisma.serviceCategory.createMany({
    data: categoryRows.map(([key, label, sortOrder]) => ({
      id: `svccat_${key.toLowerCase()}`,
      key,
      label,
      sortOrder,
    })),
  });

  // A provider is the same Person with a service-provider role plus a profile.
  const tarisai = await prisma.person.create({
    data: {
      id: 'person_tarisai',
      phoneNumber: '+263771000005',
      givenName: 'Tarisai',
      familyName: 'Chikomo',
      displayName: 'Tarisai Chikomo',
      username: 'tarisai',
      bio: 'Runs Campus Print Hub next to the Students Union.',
      accountState: 'ACTIVE',
    },
  });
  const printHub = await prisma.serviceProviderProfile.create({
    data: {
      id: 'svcp_printhub',
      personId: tarisai.id,
      providerName: 'Campus Print Hub',
      tagline: 'Printing, binding and lamination beside the Students Union',
      about:
        'Campus Print Hub has served UZ students since 2019. Walk-in printing and same-day thesis binding.',
      status: 'ACTIVE',
      verified: true,
      respondsWithinHours: 2,
      completedBookings: 184,
    },
  });
  await prisma.serviceProviderVerification.create({
    data: {
      id: 'svcv_printhub',
      providerId: printHub.id,
      status: 'APPROVED',
      submittedNotes: 'Student Union trading permit 2026.',
      reviewedById: moyo.id,
      reviewedAt: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    },
  });
  const printHubLocation = await prisma.serviceLocation.create({
    data: {
      id: 'svcl_printhub',
      providerId: printHub.id,
      label: 'Students Union Arcade, Shop 4',
      building: 'Students Union',
      room: 'Shop 4',
      address: 'University of Zimbabwe, Mount Pleasant',
      instructions: 'Enter through the arcade doors and turn right.',
      accessibilityInformation: 'Step-free entrance from the arcade. Counter height 900mm.',
    },
  });

  const printingCategoryId = 'svccat_printing';
  const printService = await prisma.service.create({
    data: {
      id: 'svc_print',
      providerId: printHub.id,
      categoryId: printingCategoryId,
      title: 'Campus Printing',
      summary: 'Print, copy and scan',
      description:
        'Black-and-white and colour printing from a USB drive or an emailed PDF. Collect at the counter.',
      status: 'AVAILABLE',
      serviceMode: 'PICKUP',
      pricingModel: 'PER_UNIT',
      priceAmount: '0.10',
      priceCurrency: 'USD',
      priceUnit: 'page',
      pricingNotes: 'Colour pages are charged at USD 0.35 per page.',
      bookingPolicy: 'OPEN_BOOKING',
      bookingType: 'ORDER',
      capacityType: 'LIMITED',
      capacityValue: 5,
      durationMinutes: 30,
      leadTimeMinutes: 30,
      cancellationWindowMinutes: 30,
      locationId: printHubLocation.id,
      ratingAverage: 4.6,
      ratingCount: 2,
      bookingCount: 184,
      publishedAt: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
    },
  });
  // Dynamic booking form: the client renders whatever the provider defined.
  await prisma.serviceBookingField.createMany({
    data: [
      {
        id: 'sbf_print_pages',
        serviceId: printService.id,
        key: 'pages',
        label: 'Number of pages',
        fieldType: 'NUMBER',
        required: true,
        minValue: 1,
        maxValue: 500,
        sortOrder: 0,
      },
      {
        id: 'sbf_print_size',
        serviceId: printService.id,
        key: 'paperSize',
        label: 'Paper size',
        fieldType: 'SELECT',
        required: true,
        options: ['A4', 'A3'],
        sortOrder: 1,
      },
      {
        id: 'sbf_print_colour',
        serviceId: printService.id,
        key: 'colour',
        label: 'Colour printing',
        helpText: 'Colour pages cost more. Leave off for black and white.',
        fieldType: 'BOOLEAN',
        required: false,
        sortOrder: 2,
      },
      {
        id: 'sbf_print_file',
        serviceId: printService.id,
        key: 'document',
        label: 'Document to print',
        helpText: 'Attach a PDF, or bring a USB drive to the counter.',
        fieldType: 'FILE',
        required: false,
        sortOrder: 3,
      },
    ],
  });
  await prisma.serviceAvailabilityRule.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      id: `savr_print_${dayOfWeek}`,
      serviceId: printService.id,
      dayOfWeek,
      startMinute: 8 * 60,
      endMinute: 17 * 60,
      slotMinutes: 30,
      capacity: 5,
    })),
  });
  await prisma.serviceAvailabilityException.create({
    data: {
      id: 'save_print_holiday',
      serviceId: printService.id,
      date: new Date(Date.UTC(2026, 11, 25)),
      closed: true,
      reason: 'Christmas Day',
    },
  });

  const bindingService = await prisma.service.create({
    data: {
      id: 'svc_binding',
      providerId: printHub.id,
      categoryId: printingCategoryId,
      title: 'Thesis Binding & Lamination',
      summary: 'Hard and soft binding, same day',
      description:
        'Bring your printed thesis for hard or soft binding. Gold lettering available on request.',
      status: 'PUBLISHED',
      serviceMode: 'APPOINTMENT',
      pricingModel: 'FROM',
      priceAmount: '5.00',
      priceCurrency: 'USD',
      bookingPolicy: 'REQUEST_APPROVAL',
      bookingType: 'APPOINTMENT',
      capacityType: 'SINGLE',
      durationMinutes: 30,
      leadTimeMinutes: 120,
      cancellationWindowMinutes: 120,
      locationId: printHubLocation.id,
      publishedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.serviceBookingField.createMany({
    data: [
      {
        id: 'sbf_bind_type',
        serviceId: bindingService.id,
        key: 'bindingType',
        label: 'Binding type',
        fieldType: 'SELECT',
        required: true,
        options: ['Hard binding', 'Soft binding', 'Spiral'],
        sortOrder: 0,
      },
      {
        id: 'sbf_bind_copies',
        serviceId: bindingService.id,
        key: 'copies',
        label: 'Copies',
        fieldType: 'NUMBER',
        required: true,
        minValue: 1,
        maxValue: 10,
        sortOrder: 1,
      },
      {
        id: 'sbf_bind_lettering',
        serviceId: bindingService.id,
        key: 'lettering',
        label: 'Gold lettering text',
        fieldType: 'TEXT',
        required: false,
        maxLength: 80,
        sortOrder: 2,
      },
    ],
  });
  await prisma.serviceAvailabilityRule.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      id: `savr_bind_${dayOfWeek}`,
      serviceId: bindingService.id,
      dayOfWeek,
      startMinute: 9 * 60,
      endMinute: 16 * 60,
      slotMinutes: 30,
    })),
  });

  // Matthew is also a provider: the same account, a second contextual role.
  const matthewProvider = await prisma.serviceProviderProfile.create({
    data: {
      id: 'svcp_matthew',
      personId: matthew.id,
      providerName: 'Matthew — Maths & Control Systems Tutoring',
      tagline: 'Fourth-year EE student, small-group tutoring',
      status: 'ACTIVE',
      respondsWithinHours: 12,
    },
  });
  const tutoringService = await prisma.service.create({
    data: {
      id: 'svc_tutoring',
      providerId: matthewProvider.id,
      categoryId: 'svccat_tutoring',
      title: 'Control Systems Tutoring',
      summary: 'One-hour sessions for EENG401',
      description: 'Root locus, Nyquist and PID design, worked through past papers.',
      status: 'AVAILABLE',
      serviceMode: 'ON_SITE',
      pricingModel: 'FIXED',
      priceAmount: '3.00',
      priceCurrency: 'USD',
      bookingPolicy: 'REQUEST_APPROVAL',
      bookingType: 'APPOINTMENT',
      capacityType: 'LIMITED',
      capacityValue: 4,
      durationMinutes: 60,
      leadTimeMinutes: 240,
      publishedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
    },
  });
  await prisma.serviceAvailabilityRule.createMany({
    data: [2, 4].map((dayOfWeek) => ({
      id: `savr_tut_${dayOfWeek}`,
      serviceId: tutoringService.id,
      dayOfWeek,
      startMinute: 16 * 60,
      endMinute: 19 * 60,
      slotMinutes: 60,
      capacity: 4,
    })),
  });

  // A REQUESTED booking. Requesting is not confirming: no slot is held yet.
  const bindingStart = nextWeekdayAtLocal(now, 2, 10, 0);
  const requestedBooking = await prisma.booking.create({
    data: {
      id: 'bkg_requested',
      serviceId: bindingService.id,
      providerId: printHub.id,
      customerId: matthew.id,
      bookingType: 'APPOINTMENT',
      status: 'REQUESTED',
      requestedStart: bindingStart,
      requestedEnd: new Date(bindingStart.getTime() + 30 * 60 * 1000),
      quantity: 1,
      customerNotes: 'Final year project report. I can collect the same afternoon.',
      locationId: printHubLocation.id,
      requestedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      fieldValues: {
        create: [
          {
            id: 'bfv_req_type',
            fieldId: 'sbf_bind_type',
            key: 'bindingType',
            label: 'Binding type',
            valueText: 'Hard binding',
          },
          {
            id: 'bfv_req_copies',
            fieldId: 'sbf_bind_copies',
            key: 'copies',
            label: 'Copies',
            valueNumber: '2',
          },
          {
            id: 'bfv_req_lettering',
            fieldId: 'sbf_bind_lettering',
            key: 'lettering',
            label: 'Gold lettering text',
            valueText: 'M. DZIIRUTSVA — EENG 2026',
          },
        ],
      },
      statusHistory: {
        create: [
          {
            id: 'bsh_req_1',
            actorId: matthew.id,
            fromStatus: 'DRAFT',
            toStatus: 'REQUESTED',
            createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });
  const requestedConversation = await prisma.conversation.create({
    data: {
      id: 'conv_bkg_requested',
      kind: 'SERVICE',
      title: bindingService.title,
      contextType: 'BOOKING',
      contextId: requestedBooking.id,
      createdById: matthew.id,
      lastActivityAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      participants: {
        create: [
          { id: 'cpart_bkgreq_matthew', personId: matthew.id },
          { id: 'cpart_bkgreq_tarisai', personId: tarisai.id, role: 'OWNER' },
        ],
      },
    },
  });
  await prisma.booking.update({
    where: { id: requestedBooking.id },
    data: { conversationId: requestedConversation.id },
  });

  // A CONFIRMED booking, with the Activity that puts it in the existing Calendar.
  const printStart = nextWeekdayAtLocal(now, 1, 11, 0);
  const printEnd = new Date(printStart.getTime() + 30 * 60 * 1000);
  const printActivity = await prisma.activity.create({
    data: {
      id: 'activity_bkg_print',
      type: 'SERVICE_BOOKING',
      title: `${printService.title} — ${printHub.providerName}`,
      startTime: printStart,
      endTime: printEnd,
      timezone: 'Africa/Harare',
      location: printHubLocation.label,
      status: 'SCHEDULED',
      relevanceWeight: 60,
      sourceType: 'BOOKING',
      sourceId: 'bkg_confirmed',
      organizerType: 'SERVICE_PROVIDER',
      organizerId: printHub.id,
      visibility: 'PRIVATE',
      ownerPersonId: matthew.id,
    },
  });
  const confirmedBooking = await prisma.booking.create({
    data: {
      id: 'bkg_confirmed',
      serviceId: printService.id,
      providerId: printHub.id,
      customerId: matthew.id,
      bookingType: 'ORDER',
      status: 'CONFIRMED',
      requestedStart: printStart,
      requestedEnd: printEnd,
      confirmedStart: printStart,
      confirmedEnd: printEnd,
      quantity: 1,
      customerNotes: 'Assignment 2 write-up, double sided if possible.',
      providerMessage: 'Confirmed. Ready for collection from 11:00.',
      providerInternalNotes: 'Regular customer — charge the student rate.',
      locationId: printHubLocation.id,
      activityId: printActivity.id,
      requestedAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      confirmedAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      version: 2,
      fieldValues: {
        create: [
          {
            id: 'bfv_conf_pages',
            fieldId: 'sbf_print_pages',
            key: 'pages',
            label: 'Number of pages',
            valueNumber: '24',
          },
          {
            id: 'bfv_conf_size',
            fieldId: 'sbf_print_size',
            key: 'paperSize',
            label: 'Paper size',
            valueText: 'A4',
          },
          {
            id: 'bfv_conf_colour',
            fieldId: 'sbf_print_colour',
            key: 'colour',
            label: 'Colour printing',
            valueBoolean: false,
          },
        ],
      },
      statusHistory: {
        create: [
          {
            id: 'bsh_conf_1',
            actorId: matthew.id,
            fromStatus: 'DRAFT',
            toStatus: 'REQUESTED',
            createdAt: new Date(now.getTime() - 26 * 60 * 60 * 1000),
          },
          {
            id: 'bsh_conf_2',
            actorId: tarisai.id,
            fromStatus: 'REQUESTED',
            toStatus: 'CONFIRMED',
            createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
          },
        ],
      },
    },
  });
  const confirmedConversation = await prisma.conversation.create({
    data: {
      id: 'conv_bkg_confirmed',
      kind: 'SERVICE',
      title: printService.title,
      contextType: 'BOOKING',
      contextId: confirmedBooking.id,
      createdById: matthew.id,
      lastActivityAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      participants: {
        create: [
          { id: 'cpart_bkgconf_matthew', personId: matthew.id },
          { id: 'cpart_bkgconf_tarisai', personId: tarisai.id, role: 'OWNER' },
        ],
      },
    },
  });
  await prisma.message.create({
    data: {
      id: 'msg_bkg_confirmed',
      conversationId: confirmedConversation.id,
      senderId: tarisai.id,
      body: 'Confirmed for 11:00. Bring your student card for the student rate.',
      createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
    },
  });
  await prisma.conversation.update({
    where: { id: confirmedConversation.id },
    data: { lastMessageId: 'msg_bkg_confirmed' },
  });
  await prisma.booking.update({
    where: { id: confirmedBooking.id },
    data: { conversationId: confirmedConversation.id },
  });
  // Reminders come from the existing activity/reminder path.
  await prisma.activityReminder.create({
    data: {
      id: 'arem_bkg_print',
      activityId: printActivity.id,
      personId: matthew.id,
      offsetMinutes: 60,
    },
  });

  // A completed booking with the one review it is allowed to carry.
  const completedStart = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
  const completedBooking = await prisma.booking.create({
    data: {
      id: 'bkg_completed',
      serviceId: printService.id,
      providerId: printHub.id,
      customerId: matthew.id,
      bookingType: 'ORDER',
      status: 'COMPLETED',
      requestedStart: completedStart,
      requestedEnd: new Date(completedStart.getTime() + 30 * 60 * 1000),
      confirmedStart: completedStart,
      confirmedEnd: new Date(completedStart.getTime() + 30 * 60 * 1000),
      quantity: 1,
      requestedAt: new Date(completedStart.getTime() - 60 * 60 * 1000),
      confirmedAt: new Date(completedStart.getTime() - 30 * 60 * 1000),
      startedAt: completedStart,
      completedAt: new Date(completedStart.getTime() + 25 * 60 * 1000),
      version: 4,
    },
  });
  await prisma.serviceReview.create({
    data: {
      id: 'srev_print_matthew',
      serviceId: printService.id,
      providerId: printHub.id,
      bookingId: completedBooking.id,
      authorId: matthew.id,
      rating: 5,
      body: 'Ready when they said it would be, and the binding is neat.',
      providerResponse: 'Thank you Matthew, see you next semester.',
      providerRespondedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.serviceAudit.createMany({
    data: [
      {
        id: 'saudit_seed_confirm',
        actorId: tarisai.id,
        action: 'BOOKING_CONFIRMED',
        providerId: printHub.id,
        serviceId: printService.id,
        bookingId: confirmedBooking.id,
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
      },
      {
        id: 'saudit_seed_publish',
        actorId: tarisai.id,
        action: 'SERVICE_PUBLISHED',
        providerId: printHub.id,
        serviceId: bindingService.id,
        createdAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
    ],
  });

  // ---------------------------------------------------------------------------
  // Notifications carry the new required type/category and a resolved deep link.
  // ---------------------------------------------------------------------------
  await prisma.notification.createMany({
    data: [
      {
        id: 'ntf_booking_confirmed',
        personId: matthew.id,
        type: 'BOOKING_CONFIRMED',
        category: 'SERVICE',
        priority: 'HIGH',
        title: printService.title,
        body: 'Confirmed — ready for collection from 11:00.',
        sourceType: 'BOOKING',
        sourceId: confirmedBooking.id,
        sourceActivityId: printActivity.id,
        deepLink: `/app/services/bookings/${confirmedBooking.id}`,
        status: 'DELIVERED',
        deliveredAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 25 * 60 * 60 * 1000),
        idempotencyKey: `${confirmedBooking.id}:CONFIRMED:${matthew.id}`,
      },
      {
        id: 'ntf_booking_requested',
        personId: tarisai.id,
        type: 'BOOKING_REQUESTED',
        category: 'SERVICE',
        title: 'New booking request',
        body: 'Matthew Dziirutsva requested Thesis Binding & Lamination.',
        sourceType: 'BOOKING',
        sourceId: requestedBooking.id,
        deepLink: `/app/services/bookings/${requestedBooking.id}`,
        status: 'DELIVERED',
        deliveredAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
        idempotencyKey: `${requestedBooking.id}:REQUESTED:${tarisai.id}`,
      },
      {
        id: 'ntf_direct_message',
        personId: matthew.id,
        type: 'DIRECT_MESSAGE',
        category: 'SOCIAL',
        title: 'Tawanda M.',
        body: 'I uploaded the study guide under Resources if it helps.',
        sourceType: 'CONVERSATION',
        sourceId: directConversation.id,
        deepLink: `/app/messages/${directConversation.id}`,
        status: 'DELIVERED',
        deliveredAt: new Date(now.getTime() - 20 * 60 * 1000),
        createdAt: new Date(now.getTime() - 20 * 60 * 1000),
        idempotencyKey: `msg_direct_3:${matthew.id}:DIRECT_MESSAGE`,
      },
      {
        id: 'ntf_follow',
        personId: matthew.id,
        type: 'FOLLOW',
        category: 'SOCIAL',
        priority: 'LOW',
        title: 'Tawanda M. started following you.',
        body: 'View their profile.',
        sourceType: 'PERSON',
        sourceId: tawanda.id,
        deepLink: `/app/profile/${tawanda.id}`,
        status: 'DELIVERED',
        deliveredAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        idempotencyKey: `flw_tawanda_matthew:${matthew.id}:FOLLOW`,
      },
      {
        id: 'ntf_connection_request',
        personId: matthew.id,
        type: 'CONNECTION_REQUEST',
        category: 'SOCIAL',
        title: 'Rudo Ncube wants to connect.',
        body: 'Accept or decline the request.',
        sourceType: 'CONNECTION',
        sourceId: rep.id,
        deepLink: `/app/profile/${rep.id}`,
        status: 'DELIVERED',
        deliveredAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        createdAt: new Date(now.getTime() - 6 * 60 * 60 * 1000),
        idempotencyKey: `cnx_rudo_matthew:${matthew.id}:CONNECTION_REQUEST`,
      },
    ],
  });

  console.log('CampusOS seed complete. Student login: +263771234567 OTP 123456');
}

/**
 * Returns a UTC instant for a local (UTC+2) wall-clock time, skipping forward
 * past weekends so seeded bookings land inside the weekday availability rules.
 */
function nextWeekdayAtLocal(from: Date, daysAhead: number, hour: number, minute: number): Date {
  const candidate = new Date(from.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  while (candidate.getUTCDay() === 0 || candidate.getUTCDay() === 6) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  return new Date(
    Date.UTC(
      candidate.getUTCFullYear(),
      candidate.getUTCMonth(),
      candidate.getUTCDate(),
      hour - 2,
      minute,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
