import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PresenceService } from '../events/presence.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly presenceService: PresenceService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: { userId: string }) {
    return this.usersService.getProfile(user.userId);
  }

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query('q') q?: string,
    @Query('limit') limitRaw?: string,
  ) {
    if (typeof q === 'string' && q.trim().length > 0) {
      const limit = Number.parseInt(limitRaw ?? '10', 10);
      return this.usersService.searchUsers(user.userId, q, Number.isNaN(limit) ? 10 : limit);
    }
    return this.usersService.listUsers(user.userId);
  }

  @Get(':id/followers')
  followers(@Param('id') id: string) {
    return this.usersService.getFollowers(id);
  }

  @Get(':id/following')
  following(@Param('id') id: string) {
    return this.usersService.getFollowing(id);
  }

  @Post('presence')
  presenceBulk(@Body() body: { userIds?: string[] }) {
    return this.presenceService.getPresenceBulk(body.userIds ?? []);
  }

  @Get(':id/presence')
  presence(@Param('id') id: string) {
    return this.presenceService.getPresence(id);
  }

  @Get(':id')
  byId(@Param('id') id: string) {
    return this.usersService.getById(id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: { userId: string }, @Body() payload: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, payload);
  }

  @Post(':id/follow')
  followToggle(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.usersService.toggleFollow(user.userId, id);
  }
}
