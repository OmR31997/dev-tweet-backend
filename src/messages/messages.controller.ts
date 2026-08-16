import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SendMessageDto } from './dto/send-message.dto';
import { ToggleReactionDto } from './dto/toggle-reaction.dto';
import { BulkDeleteMessagesDto } from './dto/bulk-delete-messages.dto';
import { ForwardMessagesDto } from './dto/forward-messages.dto';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  send(@CurrentUser() user: { userId: string }, @Body() payload: SendMessageDto) {
    return this.messagesService.send(user.userId, payload);
  }

  @Delete(':otherUserId/clear/all')
  clearConversationForEveryone(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.clearConversationForEveryone(user.userId, otherUserId);
  }

  @Delete(':otherUserId/clear')
  clearConversation(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.clearConversation(user.userId, otherUserId);
  }

  @Delete('item/:id/for-me')
  deleteMessageForMe(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.messagesService.deleteMessageForMe(user.userId, id);
  }

  @Delete('item/:id/for-everyone')
  deleteMessageForEveryone(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
  ) {
    return this.messagesService.deleteMessageForEveryone(user.userId, id);
  }

  @Delete('item/:id')
  deleteMessage(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.messagesService.deleteMessage(user.userId, id);
  }

  @Post('item/:id/reaction')
  toggleReaction(
    @CurrentUser() user: { userId: string },
    @Param('id') id: string,
    @Body() payload: ToggleReactionDto,
  ) {
    return this.messagesService.toggleReaction(user.userId, id, payload.emoji);
  }

  @Delete('bulk')
  deleteMessages(
    @CurrentUser() user: { userId: string },
    @Body() payload: BulkDeleteMessagesDto,
  ) {
    return this.messagesService.deleteMessages(
      user.userId,
      payload.messageIds,
      payload.forEveryone ?? true,
    );
  }

  @Post('forward')
  forwardMessages(
    @CurrentUser() user: { userId: string },
    @Body() payload: ForwardMessagesDto,
  ) {
    return this.messagesService.forwardMessages(user.userId, payload);
  }

  @Get('chats')
  listChats(
    @CurrentUser() user: { userId: string },
    @Query('archived') archived?: string,
  ) {
    return this.messagesService.listDmChats(user.userId, archived === 'true');
  }

  @Get('archived/count')
  archivedCount(@CurrentUser() user: { userId: string }) {
    return this.messagesService.archivedCount(user.userId);
  }

  @Post(':otherUserId/archive')
  archiveChat(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.archiveDm(user.userId, otherUserId);
  }

  @Post(':otherUserId/unarchive')
  unarchiveChat(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.unarchiveDm(user.userId, otherUserId);
  }

  @Get('unread/count')
  unreadCount(@CurrentUser() user: { userId: string }) {
    return this.messagesService.unreadCount(user.userId);
  }

  @Post(':otherUserId/read')
  markConversationRead(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.markConversationRead(user.userId, otherUserId);
  }

  @Get(':otherUserId')
  conversation(
    @CurrentUser() user: { userId: string },
    @Param('otherUserId') otherUserId: string,
  ) {
    return this.messagesService.conversation(user.userId, otherUserId);
  }
}
