import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

/** Raíz + liveness (sin autenticación). El probe del frontend usa solo GET /health. */
@ApiExcludeController()
@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      service: 'walvy-api',
      health: '/health',
      docs: '/api',
    };
  }

  @Get('health')
  health() {
    return { ok: true };
  }
}
