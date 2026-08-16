import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommentsService } from './comments.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@ApiBearerAuth('access-token')
@Controller()
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('posts/:postId/comments')
  list(@Param('postId') postId: string) {
    return this.commentsService.listForPost(postId);
  }

  @Post('posts/:postId/comments')
  create(
    @CurrentUser() user: { userId: string },
    @Param('postId') postId: string,
    @Body() payload: CreateCommentDto,
  ) {
    return this.commentsService.create(postId, user.userId, payload);
  }

  @Post('comments/:id/like')
  toggleLike(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.commentsService.toggleLike(id, user.userId);
  }

  @Delete('comments/:id')
  delete(@CurrentUser() user: { userId: string }, @Param('id') id: string) {
    return this.commentsService.delete(id, user.userId);
  }
}
