import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConversationsService } from './conversations.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { SendGroupMessageDto } from './dto/send-group-message.dto';

@ApiTags('conversations')
@ApiBearerAuth('access-token')
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  list(
    @CurrentUser() user: { userId: string },
    @Query('archived') archived?: string,
  ) {
    return this.conversationsService.listForUser(
      user.userId,
      archived === 'true',
    );
  }

  @Post('group')
  createGroup(
    @CurrentUser() user: { userId: string },
    @Body() payload: CreateGroupDto,
  ) {
    return this.conversationsService.createGroup(user.userId, payload);
  }

  @Post(':id/archive')
  archive(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.archiveGroup(id, user.userId);
  }

  @Post(':id/unarchive')
  unarchive(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.unarchiveGroup(id, user.userId);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.getById(id, user.userId);
  }

  @Patch(':id')
  updateGroup(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() payload: UpdateGroupDto,
  ) {
    return this.conversationsService.updateGroup(id, user.userId, payload);
  }

  @Get(':id/messages')
  messages(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.getMessages(id, user.userId);
  }

  @Post(':id/messages')
  sendMessage(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() payload: SendGroupMessageDto,
  ) {
    return this.conversationsService.sendGroupMessage(id, user.userId, payload);
  }

  @Post(':id/read')
  markRead(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.markGroupRead(id, user.userId);
  }

  @Delete(':id/clear/all')
  clearChatForEveryone(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.clearGroupChatForEveryone(id, user.userId);
  }

  @Delete(':id/clear')
  clearChat(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.conversationsService.clearGroupChat(id, user.userId);
  }

  @Post(':id/participants/:userId')
  addParticipant(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationsService.addParticipant(id, user.userId, userId);
  }

  @Post(':id/participants/:userId/admin')
  promoteAdmin(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationsService.promoteAdmin(id, user.userId, userId);
  }

  @Delete(':id/participants/:userId/admin')
  demoteAdmin(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationsService.demoteAdmin(id, user.userId, userId);
  }

  @Delete(':id/participants/:userId')
  removeParticipant(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.conversationsService.removeParticipant(id, user.userId, userId);
  }
}
