import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { ContentService } from './content.service';
import { PostContextType, PostVisibility } from './content-policy';
import { FeedFilter } from './feed-query';

class CreatePostDto {
  @IsString()
  body!: string;

  @IsString()
  contextType!: PostContextType;

  @IsOptional()
  @IsString()
  contextId?: string;

  @IsOptional()
  @IsString()
  visibility?: PostVisibility;

  @IsOptional()
  fileIds?: string[];

  @IsOptional()
  resourceIds?: string[];
}

@Controller()
@UseGuards(AuthGuard)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get('feed')
  feed(
    @CurrentActor() actor: Actor,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
    @Query('filter') filter?: FeedFilter,
    @Query('contextType') contextType?: PostContextType,
    @Query('contextId') contextId?: string,
    @Query('since') since?: string,
  ) {
    return this.content.feed(actor.personId, {
      cursor,
      limit: limit ? Number(limit) : undefined,
      filter,
      contextType,
      contextId,
      since,
    });
  }

  @Post('posts')
  create(@CurrentActor() actor: Actor, @Body() body: CreatePostDto) {
    return this.content.createPost(actor.personId, body);
  }

  @Get('posts/:postId')
  get(@CurrentActor() actor: Actor, @Param('postId') postId: string) {
    return this.content.getPost(actor.personId, postId);
  }

  @Patch('posts/:postId')
  edit(@CurrentActor() actor: Actor, @Param('postId') postId: string, @Body() body: { body: string }) {
    return this.content.editPost(actor.personId, postId, body.body);
  }

  @Post('posts/:postId/remove')
  remove(@CurrentActor() actor: Actor, @Param('postId') postId: string) {
    return this.content.removePost(actor.personId, postId);
  }
}
