import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsString()
  photoURL?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;

  @IsOptional()
  @IsString()
  college?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  year?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  githubUsername?: string;

  @IsOptional()
  @IsBoolean()
  emailNotificationsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyDigestEnabled?: boolean;
}
