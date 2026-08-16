import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { PostAttachmentDto } from './post-attachment.dto';

export class CreatePostDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsArray()
  imageIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PostAttachmentDto)
  attachments?: PostAttachmentDto[];

  @IsOptional()
  @IsArray()
  tags?: string[];
}
