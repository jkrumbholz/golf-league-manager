import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CourseNameService } from '../../services/course-name.service';
import { Dashboard } from '../../models/dashboard';
import { formatOption, supportsVirtualPartner } from '../../models/formats';
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
  busy = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private courseNames: CourseNameService
  ) {}

  async ngOnInit(): Promise<void> {
    this.eventId = Number(this.route.snapshot.paramMap.get('eventId'));
    try {
      this.dashboard = await this.api.post<Dashboard>('dashboard', { eventId: this.eventId });
      if (this.dashboard.role !== 'organizer' && this.dashboard.role !== 'collector') {
        await this.router.navigate(['/events', this.eventId]);
        return;
      }
      await this.courseNames.ensureConfigurations(this.dashboard.event.facilityId);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this event';
    }
  }

  get backTo(): unknown[] {
    if (this.paymentsOnly) return ['/events', this.eventId];
    return this.dashboard ? ['/admin/seasons', this.dashboard.event.seasonId] : ['/admin/leagues'];
  }

  get paymentsOnly(): boolean {
    return this.dashboard?.role === 'collector';
  }

  setupLink(commands: unknown[]): unknown[] | null {
    return this.paymentsOnly ? null : commands;
  }

  get teamFormat(): boolean {
    return formatOption(this.dashboard?.event.format || '').team;
  }

  get sideGames(): boolean {
    return !!this.dashboard && (this.dashboard.event.ctpEnabled || this.dashboard.event.longDriveEnabled);
  }

  get virtualPartnerFormat(): boolean {
    return supportsVirtualPartner(this.dashboard?.event.format || '');
  }

  partnerSummary(): string {
    const partner = this.dashboard?.virtualPartner;
    if (!partner) return 'Not set';
    if (partner.selected) return `${partner.designated.displayName} with ${partner.selected.displayName}`;
    return `${partner.designated.displayName} is waiting on a draw`;
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

  async setScoring(scoringEnabled: boolean): Promise<void> {
    if (!this.dashboard || this.busy) return;
    this.error = '';
    this.busy = true;
    try {
      await this.api.put('event', { action: 'setScoring', id: this.eventId, scoringEnabled });
      this.dashboard.event.scoringEnabled = scoringEnabled;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not change scoring';
    } finally {
      this.busy = false;
    }
  }

  async archive(): Promise<void> {
    if (!this.dashboard || this.busy) return;
    const name = this.dashboard.event.name;
    if (!window.confirm(`Archive ${name}? It leaves this season. You can delete it from Archive.`)) return;
    this.busy = true;
    this.error = '';
    try {
      await this.api.put('event', { action: 'archive', id: this.eventId });
      await this.router.navigate(this.backTo);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not archive this event';
      this.busy = false;
    }
  }
}
