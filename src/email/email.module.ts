import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailService } from './email.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Notification, NotificationSchema } from '../notifications/schemas/notification.schema';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
