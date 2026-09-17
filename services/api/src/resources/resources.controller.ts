import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ResourceRelationshipType, ResourceVisibility } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { ResourcesService } from './resources.service';

class CreateResourceDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  resourceType!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  fileId!: string;

  @IsOptional()
  @IsEnum(ResourceVisibility)
  visibility?: ResourceVisibility;

  @IsOptional()
  @IsString()
  categoryId?: string;
}

class MetadataDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  academicYear?: number;

  @IsOptional()
  @IsBoolean()
  solutionAvailable?: boolean;
}

class VersionDto {
  @IsString()
  fileId!: string;

  @IsOptional()
  @IsString()
  changeSummary?: string;
}

class RelateDto {
  @IsString()
  toResourceId!: string;

  @IsEnum(ResourceRelationshipType)
  type!: ResourceRelationshipType;
}

@Controller()
@UseGuards(AuthGuard)
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Get('resource-categories')
  categories() {
    return this.resources.categories();
  }

  @Get('course-offerings/:courseOfferingId/resources')
  list(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Query('q') q?: string,
  ) {
    return this.resources.list(actor.personId, courseOfferingId, q);
  }

  @Post('course-offerings/:courseOfferingId/resources')
  create(
    @CurrentActor() actor: Actor,
    @Param('courseOfferingId') courseOfferingId: string,
    @Body() body: CreateResourceDto,
  ) {
    return this.resources.create(actor.personId, courseOfferingId, body);
  }

  @Get('resources/:resourceId')
  get(@CurrentActor() actor: Actor, @Param('resourceId') resourceId: string) {
    return this.resources.get(actor.personId, resourceId);
  }

  @Patch('resources/:resourceId')
  update(
    @CurrentActor() actor: Actor,
    @Param('resourceId') resourceId: string,
    @Body() body: MetadataDto,
  ) {
    return this.resources.updateMetadata(actor.personId, resourceId, body);
  }

  @Post('resources/:resourceId/versions')
  version(
    @CurrentActor() actor: Actor,
    @Param('resourceId') resourceId: string,
    @Body() body: VersionDto,
  ) {
    return this.resources.addVersion(actor.personId, resourceId, body);
  }

  @Post('resources/:resourceId/endorse')
  endorse(
    @CurrentActor() actor: Actor,
    @Param('resourceId') resourceId: string,
    @Body() body: { comment?: string },
  ) {
    return this.resources.endorse(actor.personId, resourceId, body.comment);
  }

  @Post('resources/:resourceId/relationships')
  relate(
    @CurrentActor() actor: Actor,
    @Param('resourceId') resourceId: string,
    @Body() body: RelateDto,
  ) {
    return this.resources.relate(actor.personId, resourceId, body.toResourceId, body.type);
  }

  @Post('resources/:resourceId/share')
  share(@CurrentActor() actor: Actor, @Param('resourceId') resourceId: string) {
    return this.resources.share(actor.personId, resourceId);
  }

  @Post('resources/:resourceId/report')
  report(
    @CurrentActor() actor: Actor,
    @Param('resourceId') resourceId: string,
    @Body() body: { reason?: string; details?: string },
  ) {
    return this.resources.report(actor.personId, resourceId, body);
  }
}
