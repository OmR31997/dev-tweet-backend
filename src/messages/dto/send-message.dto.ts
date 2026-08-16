import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MessageAttachmentDto } from './message-attachment.dto';

export class SendMessageDto {
  @IsString()
  recipientId: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  content?: string;

  @IsOptional()
  @IsIn(['text', 'image', 'document'])
  messageType?: 'text' | 'image' | 'document';

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageAttachmentDto)
  attachment?: MessageAttachmentDto;

  @IsOptional()
  @IsString()
  replyToId?: string;
}
