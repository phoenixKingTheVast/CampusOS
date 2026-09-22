import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PeopleModule } from './people/people.module';
import { AcademicModule } from './academic/academic.module';
import { VerificationsModule } from './verifications/verifications.module';
import { HomeModule } from './home/home.module';
import { SearchModule } from './search/search.module';
import { LearnModule } from './learn/learn.module';
import { AnnouncementsModule } from './announcements/announcements.module';
import { FilesModule } from './files/files.module';
import { ResourcesModule } from './resources/resources.module';
import { NotificationsModule } from './notifications/notifications.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { LaboratoriesModule } from './laboratories/laboratories.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ExploreModule } from './explore/explore.module';
import { EventsModule } from './events/events.module';
import { CalendarModule } from './calendar/calendar.module';
import { MessagingModule } from './messaging/messaging.module';
import { CampusServicesModule } from './campus-services/campus-services.module';
import { ContentModule } from './content/content.module';
import { DiscussionsModule } from './discussions/discussions.module';
import { StudyGroupsModule } from './study-groups/study-groups.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PeopleModule,
    AcademicModule,
    VerificationsModule,
    HomeModule,
    SearchModule,
    LearnModule,
    AnnouncementsModule,
    FilesModule,
    ResourcesModule,
    NotificationsModule,
    AssessmentsModule,
    LaboratoriesModule,
    OrganizationsModule,
    ExploreModule,
    EventsModule,
    CalendarModule,
    MessagingModule,
    CampusServicesModule,
    ContentModule,
    DiscussionsModule,
    StudyGroupsModule,
  ],
})
export class AppModule {}
