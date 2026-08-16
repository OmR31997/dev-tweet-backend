import { ArrayMinSize, IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateGroupDto {
  @IsString()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  participantIds: string[];
}
