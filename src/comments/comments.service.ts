import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PostsService } from '../posts/posts.service';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RealtimeService } from '../events/realtime.service';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name) private readonly commentModel: Model<CommentDocument>,
    private readonly postsService: PostsService,
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
    private readonly realtime: RealtimeService,
  ) {}

  listForPost(postId: string) {
    return this.commentModel.find({ postId }).sort({ createdAt: 1 }).lean();
  }

  async create(postId: string, authorId: string, payload: CreateCommentDto) {
    const post = await this.postsService.findById(postId);
    if (!post) throw new NotFoundException('Post not found');

    const author = await this.usersService.getById(authorId);
    const comment = await this.commentModel.create({
      postId,
      authorId,
      authorName: author?.displayName ?? 'Developer',
      authorPhoto: author?.photoURL ?? '',
      content: payload.content,
      parentId: payload.parentId,
    });

    await this.postsService.adjustCommentCount(postId, 1);

    // Notify the post author (unless commenting on their own post).
    if (post.authorId !== authorId) {
      await this.notificationsService.create(
        post.authorId,
        authorId,
        author?.displayName ?? 'Developer',
        'comment',
        postId,
      );
      this.realtime.emitToUser(post.authorId, 'notification.created');
    }

    // Notify the parent comment author on a reply (if someone else).
    if (payload.parentId) {
      const parent = await this.commentModel.findById(payload.parentId).lean();
      if (parent && parent.authorId !== authorId && parent.authorId !== post.authorId) {
        await this.notificationsService.create(
          parent.authorId,
          authorId,
          author?.displayName ?? 'Developer',
          'comment',
          postId,
        );
        this.realtime.emitToUser(parent.authorId, 'notification.created');
      }
    }

    this.realtime.emitToUser(post.authorId, 'comment.created', { postId });

    return comment;
  }

  async toggleLike(commentId: string, userId: string) {
    const comment = await this.commentModel.findById(commentId).lean();
    if (!comment) throw new NotFoundException('Comment not found');
    const liked = comment.likes?.includes(userId);
    if (liked) {
      await this.commentModel.updateOne({ _id: commentId }, { $pull: { likes: userId } });
      return { liked: false };
    }
    await this.commentModel.updateOne({ _id: commentId }, { $addToSet: { likes: userId } });
    return { liked: true };
  }

  async delete(commentId: string, userId: string) {
    const comment = await this.commentModel.findById(commentId).lean();
    if (!comment) throw new NotFoundException('Comment not found');

    const post = await this.postsService.findById(comment.postId);
    const isCommentAuthor = comment.authorId === userId;
    const isPostAuthor = post?.authorId === userId;
    if (!isCommentAuthor && !isPostAuthor) {
      throw new ForbiddenException('Not allowed to delete this comment');
    }

    // Cascade-delete replies to this comment.
    const replies = await this.commentModel.countDocuments({ parentId: commentId });
    await this.commentModel.deleteMany({
      $or: [{ _id: commentId }, { parentId: commentId }],
    });
    await this.postsService.adjustCommentCount(comment.postId, -(1 + replies));
    return { ok: true };
  }
}
