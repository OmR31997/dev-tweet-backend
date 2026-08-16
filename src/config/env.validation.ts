import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  MONGODB_URI: string;

  @IsOptional()
  @IsString()
  PORT?: string;

  @IsOptional()
  @IsString()
  HOST?: string;

  @IsOptional()
  @IsString()
  CLIENT_ORIGIN?: string;

  @IsOptional()
  @IsString()
  APP_URL?: string;

  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_ACCESS_TTL_SECONDS?: string;

  @IsOptional()
  @IsString()
  JWT_REFRESH_TTL_SECONDS?: string;

  @IsOptional()
  @IsString()
  BREVO_API_KEY?: string;

  @IsOptional()
  @IsString()
  BREVO_API_URL?: string;

  @IsOptional()
  @IsString()
  BRAVO_MCP_API_KEY?: string;

  @IsOptional()
  @IsString()
  BRAVO_MCP_API_URL?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM?: string;

  @IsOptional()
  @IsString()
  EMAIL_FROM_NAME?: string;

  @IsOptional()
  @IsString()
  PASSWORD_RESET_URL?: string;
}

function isPlaceholderSecret(value: string | undefined) {
  if (!value) return true;
  return value.includes('replace-with') || value === 'dev-secret' || value === 'dev-refresh-secret';
}

export function validateEnv(config: Record<string, unknown>) {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  const nodeEnv = process.env.NODE_ENV ?? 'development';
  if (nodeEnv === 'production') {
    if (isPlaceholderSecret(validated.JWT_SECRET)) {
      throw new Error('JWT_SECRET must be set to a secure value in production');
    }
    if (isPlaceholderSecret(validated.JWT_REFRESH_SECRET)) {
      throw new Error('JWT_REFRESH_SECRET must be set to a secure value in production');
    }
    if (!validated.CLIENT_ORIGIN?.trim()) {
      throw new Error('CLIENT_ORIGIN must be set in production');
    }
  } else if (
    isPlaceholderSecret(validated.JWT_SECRET) ||
    isPlaceholderSecret(validated.JWT_REFRESH_SECRET)
  ) {
    console.warn(
      '[env] Using placeholder JWT secrets — fine for local dev, never use in production.',
    );
  }

  return validated;
}
