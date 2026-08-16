import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from '../messages/schemas/message.schema';
import {
  Conversation,
  ConversationSchema,
} from '../conversations/schemas/conversation.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';

@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Message.name, schema: MessageSchema },
      { name: Conversation.name, schema: ConversationSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  providers: [RealtimeService, PresenceService],
  exports: [RealtimeService, PresenceService],
})
export class EventsModule {}
