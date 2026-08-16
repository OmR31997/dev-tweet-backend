import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RepostPostDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  caption?: string;
}
