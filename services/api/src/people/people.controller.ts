import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthGuard } from '../auth/auth.guard';
import { Actor, CurrentActor } from '../common/current-actor.decorator';
import { PeopleService } from './people.service';

class ProfileDto {
  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  username!: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  givenName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  familyName?: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  displayName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @IsOptional()
  @IsString()
  givenName?: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsOptional()
  @IsString()
  familyName?: string;

  @IsOptional()
  @IsString()
  photoFileId?: string;
}

class UpdateUsernameDto {
  @IsString()
  username!: string;
}

@Controller()
@UseGuards(AuthGuard)
export class PeopleController {
  constructor(private readonly people: PeopleService) {}

  @Get('people/me')
  me(@CurrentActor() actor: Actor) {
    return this.people.me(actor.personId);
  }

  @Get('users/username/availability')
  availability(@Query('username') username: string) {
    return this.people.usernameAvailability(username ?? '');
  }

  @Post('people/me/profile')
  profile(@CurrentActor() actor: Actor, @Body() body: ProfileDto) {
    return this.people.upsertProfile(actor.personId, body);
  }

  @Patch('people/me/profile')
  updateProfile(@CurrentActor() actor: Actor, @Body() body: UpdateProfileDto) {
    return this.people.updateProfile(actor.personId, body);
  }

  @Patch('people/me/username')
  updateUsername(@CurrentActor() actor: Actor, @Body() body: UpdateUsernameDto) {
    return this.people.changeUsername(actor.personId, body.username);
  }

  // Declared last: the literal `people/...` routes above and the ones in
  // SocialController must win over this wildcard.
  @Get('people/:personId')
  person(@CurrentActor() actor: Actor, @Param('personId') personId: string) {
    return this.people.profile(actor.personId, personId);
  }
}
