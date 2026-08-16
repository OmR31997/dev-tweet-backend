import { Transform } from 'class-transformer';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsNotDisposableEmail } from '../../common/validators/not-disposable-email.validator';

export class RegisterDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @IsNotDisposableEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  displayName: string;
}
