import { inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Dashboard } from '../../models/dashboard';

/**
 * Shared plumbing for the event admin sub-screens. They all hang off one event
 * and all reload the same dashboard payload after a write.
 */
export abstract class AdminEventScreen {
  protected readonly api = inject(ApiService);
  protected readonly route = inject(ActivatedRoute);

  eventId = Number(this.route.snapshot.paramMap.get('eventId'));
  dashboard: Dashboard | null = null;
  error = '';
  busy = false;

  get backTo(): unknown[] {
    return ['/admin/events', this.eventId];
  }

  async load(): Promise<void> {
    await this.run(async () => undefined);
  }

  async reload(): Promise<void> {
    this.dashboard = await this.api.post<Dashboard>('dashboard', { eventId: this.eventId });
  }

  protected async run(work: () => Promise<unknown>): Promise<void> {
    this.error = '';
    this.busy = true;
    try {
      await work();
      await this.reload();
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Something went wrong';
    } finally {
      this.busy = false;
    }
  }
}
