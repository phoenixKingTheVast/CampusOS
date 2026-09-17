import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  ServiceBookingFieldType,
  ServiceBookingPolicy,
  ServiceCapacityType,
  ServiceMode,
  ServicePricingModel,
} from '@prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { BookingsService } from './bookings.service';
import { ProvidersService } from './providers.service';

class CreateProviderDto {
  @IsString()
  @MaxLength(80)
  providerName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @IsOptional()
  @IsString()
  contactPreference?: string;
}

class UpdateProviderDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  providerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  tagline?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  about?: string;

  @IsOptional()
  @IsString()
  contactPreference?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  respondsWithinHours?: number;
}

class VerificationDto {
  @IsOptional()
  @IsString()
  evidenceFileId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

class LocationDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  building?: string;

  @IsOptional()
  @IsString()
  room?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  instructions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  accessibilityInformation?: string;
}

class ServiceDto {
  @IsOptional()
  @IsString()
  categoryKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  summary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @IsOptional()
  @IsEnum(ServiceMode)
  serviceMode?: ServiceMode;

  @IsOptional()
  @IsEnum(ServicePricingModel)
  pricingModel?: ServicePricingModel;

  @IsOptional()
  @IsNumber()
  priceAmount?: number;

  @IsOptional()
  @IsString()
  priceCurrency?: string;

  @IsOptional()
  @IsString()
  priceUnit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  pricingNotes?: string;

  @IsOptional()
  @IsEnum(ServiceBookingPolicy)
  bookingPolicy?: ServiceBookingPolicy;

  @IsOptional()
  @IsEnum(ServiceCapacityType)
  capacityType?: ServiceCapacityType;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacityValue?: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  leadTimeMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  cancellationWindowMinutes?: number;

  @IsOptional()
  @IsString()
  locationId?: string;
}

class BookingFieldDto {
  @IsString()
  @MaxLength(40)
  key!: string;

  @IsString()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  helpText?: string;

  @IsEnum(ServiceBookingFieldType)
  fieldType!: ServiceBookingFieldType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  minValue?: number;

  @IsOptional()
  @IsInt()
  maxValue?: number;

  @IsOptional()
  @IsInt()
  maxLength?: number;
}

class BookingFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookingFieldDto)
  fields!: BookingFieldDto[];
}

class AvailabilityRuleDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute!: number;

  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute!: number;

  @IsOptional()
  @IsInt()
  @Min(5)
  slotMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}

class AvailabilityDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AvailabilityRuleDto)
  rules!: AvailabilityRuleDto[];
}

class ExceptionDto {
  @IsString()
  date!: string;

  @IsOptional()
  @IsBoolean()
  closed?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  startMinute?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1440)
  endMinute?: number;

  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}

class PauseDto {
  @IsOptional()
  @IsString()
  @MaxLength(280)
  reason?: string;
}

@Controller('service-providers')
@UseGuards(AuthGuard)
export class ProvidersController {
  constructor(
    private readonly providers: ProvidersService,
    private readonly bookings: BookingsService,
  ) {}

  @Get('me')
  me(@CurrentActor() actor: Actor) {
    return this.providers.me(actor.personId);
  }

  @Post('me')
  create(@CurrentActor() actor: Actor, @Body() body: CreateProviderDto) {
    return this.providers.createProfile(actor.personId, body);
  }

  @Patch('me')
  update(@CurrentActor() actor: Actor, @Body() body: UpdateProviderDto) {
    return this.providers.updateProfile(actor.personId, body);
  }

  @Get('me/dashboard')
  dashboard(@CurrentActor() actor: Actor) {
    return this.providers.dashboard(actor.personId);
  }

  @Post('me/verification')
  verification(@CurrentActor() actor: Actor, @Body() body: VerificationDto) {
    return this.providers.submitVerification(actor.personId, body);
  }

  @Post('me/locations')
  location(@CurrentActor() actor: Actor, @Body() body: LocationDto) {
    return this.providers.upsertLocation(actor.personId, body);
  }

  @Get('me/services')
  services(@CurrentActor() actor: Actor) {
    return this.providers.myServices(actor.personId);
  }

  @Post('me/services')
  createService(@CurrentActor() actor: Actor, @Body() body: ServiceDto) {
    return this.providers.createService(actor.personId, body);
  }

  @Patch('me/services/:serviceId')
  updateService(
    @CurrentActor() actor: Actor,
    @Param('serviceId') serviceId: string,
    @Body() body: ServiceDto,
  ) {
    return this.providers.updateService(actor.personId, serviceId, body);
  }

  @Post('me/services/:serviceId/publish')
  publish(@CurrentActor() actor: Actor, @Param('serviceId') serviceId: string) {
    return this.providers.changeServiceStatus(actor.personId, serviceId, 'PUBLISHED');
  }

  @Post('me/services/:serviceId/pause')
  pause(
    @CurrentActor() actor: Actor,
    @Param('serviceId') serviceId: string,
    @Body() body: PauseDto,
  ) {
    return this.providers.changeServiceStatus(
      actor.personId,
      serviceId,
      'UNAVAILABLE',
      body.reason,
    );
  }

  @Post('me/services/:serviceId/resume')
  resume(@CurrentActor() actor: Actor, @Param('serviceId') serviceId: string) {
    return this.providers.changeServiceStatus(actor.personId, serviceId, 'AVAILABLE');
  }

  @Post('me/services/:serviceId/discontinue')
  discontinue(@CurrentActor() actor: Actor, @Param('serviceId') serviceId: string) {
    return this.providers.changeServiceStatus(actor.personId, serviceId, 'DISCONTINUED');
  }

  @Put('me/services/:serviceId/booking-fields')
  bookingFields(
    @CurrentActor() actor: Actor,
    @Param('serviceId') serviceId: string,
    @Body() body: BookingFieldsDto,
  ) {
    return this.providers.replaceBookingFields(actor.personId, serviceId, body.fields);
  }

  @Put('me/services/:serviceId/availability')
  availability(
    @CurrentActor() actor: Actor,
    @Param('serviceId') serviceId: string,
    @Body() body: AvailabilityDto,
  ) {
    return this.providers.replaceAvailability(actor.personId, serviceId, body.rules);
  }

  @Post('me/services/:serviceId/availability/exceptions')
  addException(
    @CurrentActor() actor: Actor,
    @Param('serviceId') serviceId: string,
    @Body() body: ExceptionDto,
  ) {
    return this.providers.addException(actor.personId, serviceId, body);
  }

  @Delete('me/services/:serviceId/availability/exceptions/:exceptionId')
  removeException(
    @CurrentActor() actor: Actor,
    @Param('serviceId') serviceId: string,
    @Param('exceptionId') exceptionId: string,
  ) {
    return this.providers.removeException(actor.personId, serviceId, exceptionId);
  }

  @Get('me/bookings')
  bookingQueue(
    @CurrentActor() actor: Actor,
    @Query('status') status?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.bookings.listForProvider(actor.personId, { status, cursor });
  }

  @Get('me/reviews')
  reviews(@CurrentActor() actor: Actor, @Query('cursor') cursor?: string) {
    return this.providers.reviews(actor.personId, cursor);
  }
}
