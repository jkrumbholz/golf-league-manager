import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-settings',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-settings.component.html',
})
export class AdminEventSettingsComponent extends AdminEventScreen implements OnInit {
  private router = inject(Router);

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  async save(): Promise<void> {
    if (!this.dashboard) return;
    const event = this.dashboard.event;
    this.error = '';
    this.busy = true;
    try {
      await this.api.put('event', {
        id: event.id,
        name: event.name,
        format: event.format,
        startDate: event.startDate,
        endDate: event.endDate,
        entryFee: Number(event.entryFee),
        teamSize: event.teamSize,
        playersPickTeams: event.playersPickTeams,
        ctpEnabled: event.ctpEnabled,
        ctpEntryFee: Number(event.ctpEntryFee),
        longDriveEnabled: event.longDriveEnabled,
        longDriveEntryFee: Number(event.longDriveEntryFee),
        facilityId: event.facilityId,
        courseConfigurationId: event.courseConfigurationId,
      });
      await this.router.navigate(['/admin/events', this.eventId]);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the event';
    } finally {
      this.busy = false;
    }
  }
}
