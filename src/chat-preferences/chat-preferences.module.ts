import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatPreferencesService } from './chat-preferences.service';
import {
  ChatPreference,
  ChatPreferenceSchema,
} from './schemas/chat-preference.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatPreference.name, schema: ChatPreferenceSchema },
    ]),
  ],
  providers: [ChatPreferencesService],
  exports: [ChatPreferencesService],
})
export class ChatPreferencesModule {}
