import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import {
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { BookingsService } from './bookings.service';

class CreateBookingDto {
  @IsString()
  serviceId!: string;

  @IsOptional()
  @IsString()
  requestedStart?: string;

  @IsOptional()
  @IsString()
  requestedEnd?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerNotes?: string;

  @IsOptional()
  @IsObject()
  fieldValues?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  clientActionId?: string;

  @IsOptional()
  @IsString()
  locationId?: string;
}

class ConfirmBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @IsString()
  start?: string;

  @IsOptional()
  @IsString()
  end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  internalNotes?: string;
}

class ReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

class CompleteBookingDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class RescheduleBookingDto {
  @IsString()
  start!: string;

  @IsOptional()
  @IsString()
  end?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

class ReviewDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  body?: string;
}

class ReportDto {
  @IsString()
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

class ReviewResponseDto {
  @IsString()
  @MaxLength(2000)
  body!: string;
}

@Controller()
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

  @Get('bookings')
  list(
    @CurrentActor() actor: Actor,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.bookings.listForCustomer(actor.personId, { status, cursor });
  }

  @Post('bookings')
  create(@CurrentActor() actor: Actor, @Body() body: CreateBookingDto) {
    return this.bookings.create(actor.personId, body);
  }

  @Get('bookings/:bookingId')
  get(@CurrentActor() actor: Actor, @Param('bookingId') bookingId: string) {
    return this.bookings.get(actor.personId, bookingId);
  }

  @Get('bookings/:bookingId/conversation')
  conversation(@CurrentActor() actor: Actor, @Param('bookingId') bookingId: string) {
    return this.bookings.conversation(actor.personId, bookingId);
  }

  @Post('bookings/:bookingId/confirm')
  confirm(
    @CurrentActor() actor: Actor,
    @Param('bookingId') bookingId: string,
    @Body() body: ConfirmBookingDto,
  ) {
    return this.bookings.confirm(actor.personId, bookingId, body);
  }

  @Post('bookings/:bookingId/decline')
  decline(
    @CurrentActor() actor: Actor,
    @Param('bookingId') bookingId: string,
    @Body() body: ReasonDto,
  ) {
    return this.bookings.decline(actor.personId, bookingId, body.reason);
  }

  @Post('bookings/:bookingId/start')
  start(@CurrentActor() actor: Actor, @Param('bookingId') bookingId: string) {
    return this.bookings.start(actor.personId, bookingId);
  }

  @Post('bookings/:bookingId/complete')
  complete(
    @CurrentActor() actor: Actor,
    @Param('bookingId') bookingId: string,
    @Body() body: CompleteBookingDto,
  ) {
    return this.bookings.complete(actor.personId, bookingId, body.notes);
  }

  @Post('bookings/:bookingId/cancel')
  cancel(
    @CurrentActor() actor: Actor,
    @Param('bookingId') bookingId: string,
    @Body() body: ReasonDto,
  ) {
    return this.bookings.cancel(actor.personId, bookingId, body.reason);
  }

  @Post('bookings/:bookingId/reschedule')
  reschedule(
    @CurrentActor() actor: Actor,
    @Param('bookingId') bookingId: string,
    @Body() body: RescheduleBookingDto,
  ) {
    return this.bookings.reschedule(actor.personId, bookingId, body);
  }

  @Post('bookings/:bookingId/review')
  review(
    @CurrentActor() actor: Actor,
    @Param('bookingId') bookingId: string,
    @Body() body: ReviewDto,
  ) {
    return this.bookings.createReview(actor.personId, bookingId, body);
  }

  @Post('service-reviews/:reviewId/report')
  reportReview(
    @CurrentActor() actor: Actor,
    @Param('reviewId') reviewId: string,
    @Body() body: ReportDto,
  ) {
    return this.bookings.reportReview(actor.personId, reviewId, body);
  }

  @Post('service-reviews/:reviewId/response')
  respondToReview(
    @CurrentActor() actor: Actor,
    @Param('reviewId') reviewId: string,
    @Body() body: ReviewResponseDto,
  ) {
    return this.bookings.respondToReview(actor.personId, reviewId, body.body);
  }
}
