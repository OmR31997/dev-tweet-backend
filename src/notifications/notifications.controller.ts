import { Controller, Delete, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth('access-token')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: { userId: string }) {
    return this.notificationsService.listForUser(user.userId);
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }

  @Delete('clear')
  clear(@CurrentUser() user: { userId: string }) {
    return this.notificationsService.clearForUser(user.userId);
  }
}
