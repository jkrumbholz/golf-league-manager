import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CourseNameService } from '../../services/course-name.service';
import { Dashboard } from '../../models/dashboard';
import { formatOption } from '../../models/formats';
import { ShellComponent } from '../../ui/shell.component';

@Component({
  selector: 'app-admin-event',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './admin-event.component.html',
})
export class AdminEventComponent implements OnInit {
  eventId = 0;
  dashboard: Dashboard | null = null;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private courseNames: CourseNameService
  ) {}

  async ngOnInit(): Promise<void> {
    this.eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    try {
      this.dashboard = await this.api.post<Dashboard>('dashboard', { eventId: this.eventId });
      await this.courseNames.ensureConfigurations(this.dashboard.event.facilityId);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this event';
    }
  }

  get backTo(): unknown[] {
    return this.dashboard ? ['/admin/seasons', this.dashboard.event.seasonId] : ['/admin/leagues'];
  }

  get teamFormat(): boolean {
    return formatOption(this.dashboard?.event.format || '').team;
  }

  get sideGames(): boolean {
    return !!this.dashboard && (this.dashboard.event.ctpEnabled || this.dashboard.event.longDriveEnabled);
  }

  meta(): string {
    if (!this.dashboard) return '';
    const event = this.dashboard.event;
    const course = this.courseNames.configurationName(event.courseConfigurationId);
    const parts = [event.formatLabel, this.courseNames.shortDate(event.startDate)];
    if (course) parts.push(course);
    return parts.join(' · ');
  }

  courseSummary(): string {
    if (!this.dashboard) return '';
    const holes = this.dashboard.holes.length;
    return holes > 0 ? `${holes} holes loaded` : 'Not set up yet';
  }

  groupSummary(): string {
    const groups = this.dashboard?.groups ?? [];
    if (groups.length === 0) return 'Not set up yet';
    return `${groups.length} tee time${groups.length === 1 ? '' : 's'}`;
  }

  playerSummary(): string {
    if (!this.dashboard) return '';
    const players = this.dashboard.registrations;
    const paid = players.filter(player => player.paid).length;
    return `${players.length} signed up · ${paid} paid`;
  }
}
