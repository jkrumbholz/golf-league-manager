import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-group-form',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-group-form.component.html',
})
export class AdminEventGroupFormComponent extends AdminEventScreen {
  private router = inject(Router);
  teeTime = '';
  fieldErrors: Record<string, string> = {};

  override get backTo(): unknown[] {
    return ['/admin/events', this.eventId, 'groups'];
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    if (!this.teeTime) this.fieldErrors['teeTime'] = 'Enter a tee time';
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.error = '';
    this.busy = true;
    try {
      await this.api.put('group', { action: 'create', eventId: this.eventId, teeTime: this.teeTime });
      await this.router.navigate(this.backTo);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the tee time';
    } finally {
      this.busy = false;
    }
  }
}
