import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Skip the global JWT guard (login, register, refresh, public assets, etc.). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
