import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  root() {
    return { ok: true, service: 'devtweethub-api-v1' };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
