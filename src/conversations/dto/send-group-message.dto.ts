import { Type } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { MessageAttachmentDto } from '../../messages/dto/message-attachment.dto';

export class SendGroupMessageDto {
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
