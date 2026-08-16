import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateIf } from 'class-validator';

export class ForwardMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  messageIds: string[];

  @ValidateIf((o) => !o.conversationId)
  @IsString()
  recipientId?: string;

  @ValidateIf((o) => !o.recipientId)
  @IsString()
  conversationId?: string;
}
