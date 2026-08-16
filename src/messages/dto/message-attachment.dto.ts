import { IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class MessageAttachmentDto {
  @IsString()
  fileId: string;

  @IsString()
  mimeType: string;

  @IsString()
  filename: string;

  @IsNumber()
  @Min(1)
  size: number;
}
