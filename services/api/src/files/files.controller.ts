import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { uploadInterceptor } from './upload.interceptor';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { FilesService } from './files.service';
import { FileAction, UploadContext } from './file-policy';

class UploadSessionDto {
  @IsString()
  fileName!: string;

  @IsString()
  mimeType!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeBytes!: number;

  @IsString()
  @IsIn([
    'PROFILE_MEDIA',
    'MESSAGE_ATTACHMENT',
    'RESOURCE',
    'EVENT_MEDIA',
    'ORGANIZATION_MEDIA',
    'SERVICE_MEDIA',
    'BOOKING_ATTACHMENT',
    'VERIFICATION_EVIDENCE',
    'POST_MEDIA',
  ])
  context!: UploadContext;

  @IsOptional()
  @IsString()
  contextObjectId?: string;

  @IsOptional()
  @IsString()
  clientActionId?: string;

  @IsOptional()
  @IsString()
  checksumSha256?: string;
}

class AccessDto {
  @IsOptional()
  @IsIn(['VIEW', 'DOWNLOAD', 'SHARE', 'SAVE_OFFLINE'])
  action?: FileAction;
}

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Get('stream')
  async stream(@Query('token') token: string, @Res() response: Response) {
    const { file, body } = await this.files.streamByToken(token);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `inline; filename="${file.displayName ?? file.originalName}"`);
    response.send(body);
  }

  @Post('uploads')
  @UseGuards(AuthGuard)
  createSession(@CurrentActor() actor: Actor, @Body() body: UploadSessionDto) {
    return this.files.createUploadSession(actor.personId, body);
  }

  @Post('upload-sessions')
  @UseGuards(AuthGuard)
  createSessionAlias(@CurrentActor() actor: Actor, @Body() body: UploadSessionDto) {
    return this.files.createUploadSession(actor.personId, body);
  }

  @Post(':fileId/content')
  @UseGuards(AuthGuard)
  @UseInterceptors(uploadInterceptor)
  store(
    @CurrentActor() actor: Actor,
    @Param('fileId') fileId: string,
    @UploadedFile() file: { buffer: Buffer },
    @Query('chunkIndex') chunkIndex?: string,
  ) {
    return this.files.storeContent(actor.personId, fileId, file.buffer, chunkIndex ? Number(chunkIndex) : 0);
  }

  @Post(':fileId/complete')
  @UseGuards(AuthGuard)
  complete(@CurrentActor() actor: Actor, @Param('fileId') fileId: string) {
    return this.files.complete(actor.personId, fileId);
  }

  @Get(':fileId')
  @UseGuards(AuthGuard)
  get(@CurrentActor() actor: Actor, @Param('fileId') fileId: string) {
    return this.files.get(actor.personId, fileId);
  }

  @Post(':fileId/access')
  @UseGuards(AuthGuard)
  access(@CurrentActor() actor: Actor, @Param('fileId') fileId: string, @Body() body: AccessDto) {
    return this.files.createSignedAccess(actor.personId, fileId, body.action ?? 'VIEW');
  }

  @Get(':fileId/access')
  @UseGuards(AuthGuard)
  accessGet(
    @CurrentActor() actor: Actor,
    @Param('fileId') fileId: string,
    @Query('action') action?: FileAction,
  ) {
    return this.files.createSignedAccess(actor.personId, fileId, action ?? 'VIEW');
  }

  @Post(':fileId/archive')
  @UseGuards(AuthGuard)
  archive(@CurrentActor() actor: Actor, @Param('fileId') fileId: string) {
    return this.files.archive(actor.personId, fileId);
  }

  @Get(':fileId/download')
  @UseGuards(AuthGuard)
  async download(
    @CurrentActor() actor: Actor,
    @Param('fileId') fileId: string,
    @Res() response: Response,
  ) {
    const { file, body } = await this.files.download(actor.personId, fileId);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${file.displayName ?? file.originalName}"`);
    response.send(body);
  }
}
