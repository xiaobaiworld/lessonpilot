import type { AnalyticsEvent } from '@v1/contracts/analytics';
import type { AnalyticsAdapter } from './tracker';

export class MockAnalyticsAdapter implements AnalyticsAdapter {
  readonly events: AnalyticsEvent[] = [];

  constructor(private readonly failure?: Error) {}

  send(event: AnalyticsEvent): void {
    if (this.failure) throw this.failure;
    this.events.push(event);
  }
}
