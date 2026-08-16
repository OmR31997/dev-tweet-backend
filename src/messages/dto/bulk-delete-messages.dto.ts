import { ArrayMinSize, IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class BulkDeleteMessagesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  messageIds: string[];

  @IsOptional()
  @IsBoolean()
  forEveryone?: boolean;
}
