import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CourseNameService } from '../../services/course-name.service';
import { ShellComponent } from '../../ui/shell.component';

interface ArchivedEvent {
  id: number;
  name: string;
  formatLabel: string;
  startDate: string;
  deletedAt: string | null;
  seasonName: string;
  leagueId: number;
}

@Component({
  selector: 'app-admin-season-archive',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './admin-season-archive.component.html',
})
export class AdminSeasonArchiveComponent implements OnInit {
  seasonId = 0;
  seasonName = '';
  leagueId = 0;
  events: ArchivedEvent[] = [];
  error = '';
  busyId = 0;

  constructor(
    private route: ActivatedRoute,
    private api: ApiService,
    private courseNames: CourseNameService
  ) {}

  async ngOnInit(): Promise<void> {
    this.seasonId = Number(this.route.snapshot.paramMap.get('seasonId'));
    const params = this.route.snapshot.queryParamMap;
    this.seasonName = params.get('name') || 'Season';
    this.leagueId = Number(params.get('leagueId')) || 0;
    await this.load();
  }

  get backTo(): unknown[] {
    return ['/admin/seasons', this.seasonId];
  }

  get backQuery(): Record<string, string> {
    return { name: this.seasonName, leagueId: String(this.leagueId) };
  }

  meta(event: ArchivedEvent): string {
    const when = event.deletedAt ? this.courseNames.shortDate(event.deletedAt) : '';
    const parts = [event.formatLabel, this.courseNames.shortDate(event.startDate)];
    if (when) parts.push(`Archived ${when}`);
    return parts.join(' · ');
  }

  async remove(event: ArchivedEvent): Promise<void> {
    if (this.busyId) return;
    if (!window.confirm(`Delete ${event.name} for good? Scores, teams, and payouts are removed.`)) return;
    this.busyId = event.id;
    this.error = '';
    try {
      await this.api.put('event', { action: 'hardDelete', id: event.id });
      this.events = this.events.filter(item => item.id !== event.id);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not delete this event';
    } finally {
      this.busyId = 0;
    }
  }

  private async load(): Promise<void> {
    try {
      this.events = await this.api.post<ArchivedEvent[]>('events', { seasonId: this.seasonId, archived: true });
      if (this.events[0]?.seasonName) this.seasonName = this.events[0].seasonName;
      if (this.events[0]?.leagueId) this.leagueId = this.events[0].leagueId;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load the archive';
    }
  }
}
