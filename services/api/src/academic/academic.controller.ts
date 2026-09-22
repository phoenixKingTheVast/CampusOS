import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { AcademicService } from './academic.service';

@Controller()
@UseGuards(AuthGuard)
export class AcademicController {
  constructor(private readonly academic: AcademicService) {}

  @Get('academic/programmes')
  programmes() {
    return this.academic.programmes();
  }

  @Get('classes')
  classes(@Query('search') search?: string) {
    return this.academic.searchClasses(search);
  }

  @Post('classes/:classId/membership-requests')
  requestMembership(
    @CurrentActor() actor: Actor,
    @Param('classId') classId: string,
  ) {
    return this.academic.requestClassMembership(actor.personId, classId);
  }

  @Get('class-memberships/pending')
  pending(@CurrentActor() actor: Actor) {
    return this.academic.pendingMemberships(actor.personId);
  }

  @Post('class-memberships/:membershipId/approve')
  approve(@CurrentActor() actor: Actor, @Param('membershipId') membershipId: string) {
    return this.academic.approveMembership(actor.personId, membershipId);
  }

  @Post('class-memberships/:membershipId/reject')
  reject(@CurrentActor() actor: Actor, @Param('membershipId') membershipId: string) {
    return this.academic.rejectMembership(actor.personId, membershipId);
  }

  @Get('course-offerings/:courseOfferingId')
  offering(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
  ) {
    return this.academic.getOffering(actor.personId, courseOfferingId);
  }

  @Get('classes/:classId')
  getClass(@CurrentActor() actor: Actor, @Param('classId') classId: string) {
    return this.academic.getClass(actor.personId, classId);
  }

  @Get('course-offerings/:courseOfferingId/people')
  people(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
  ) {
    return this.academic.people(actor.personId, courseOfferingId);
  }
}
