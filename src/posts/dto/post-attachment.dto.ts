import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class PostAttachmentDto {
  @IsString()
  fileId: string;

  @IsString()
  mimeType: string;

  @IsString()
  filename: string;

  @Type(() => Number)
  @IsNumber()
  size: number;
}
