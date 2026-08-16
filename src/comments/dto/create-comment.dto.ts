import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content: string;

  /** Optional parent comment id when this is a reply. */
  @IsOptional()
  @IsString()
  parentId?: string;
}
