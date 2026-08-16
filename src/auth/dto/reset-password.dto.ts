import { IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeResetToken } from '../utils/reset-token';

export class ResetPasswordDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizeResetToken(value) : value,
  )
  @IsString()
  token: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(6)
  newPassword: string;
}
