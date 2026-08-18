import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns ok status with uptime', () => {
    const controller = new HealthController(new HealthService());
    const result = controller.getStatus();

    expect(result.status).toBe('ok');
    expect(typeof result.uptime).toBe('number');
  });
});
