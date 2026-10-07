import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CourseNameService } from '../../services/course-name.service';
import { ShellComponent } from '../../ui/shell.component';

interface SeasonEvent {
  id: number;
  name: string;
  formatLabel: string;
  startDate: string;
  status: 'done' | 'live' | 'upcoming';
  seasonName: string;
  leagueId: number;
  facilityId: number | null;
  courseConfigurationId: number | null;
}

@Component({
  selector: 'app-admin-season',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './admin-season.component.html',
})
export class AdminSeasonComponent implements OnInit {
  seasonId = 0;
  seasonName = '';
  leagueId = 0;
  events: SeasonEvent[] = [];
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private courseNames: CourseNameService
  ) {}

  async ngOnInit(): Promise<void> {
    this.seasonId = Number(this.route.snapshot.paramMap.get('seasonId'));
    try {
      const events = await this.api.post<SeasonEvent[]>('events', { seasonId: this.seasonId });
      this.events = events.sort((a, b) => b.startDate.localeCompare(a.startDate) || b.id - a.id);
      const facilityIds = [...new Set(this.events.map(event => event.facilityId).filter((id): id is number => id != null))];
      await Promise.all(facilityIds.map(id => this.courseNames.ensureConfigurations(id)));
      // An empty season has nothing to read the name from, so navigation passes it along.
      const params = this.route.snapshot.queryParamMap;
      this.seasonName = this.events[0]?.seasonName || params.get('name') || 'Season';
      this.leagueId = this.events[0]?.leagueId || Number(params.get('leagueId')) || 0;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this season';
    }
  }

  get backTo(): unknown[] {
    return this.leagueId ? ['/admin/leagues', this.leagueId] : ['/admin/leagues'];
  }

  meta(event: SeasonEvent): string {
    const course = this.courseNames.configurationName(event.courseConfigurationId);
    const parts = [event.formatLabel, this.courseNames.shortDate(event.startDate)];
    if (course) parts.push(course);
    return parts.join(' · ');
  }

  add(): void {
    void this.router.navigate(['/admin/seasons', this.seasonId, 'events', 'new']);
  }
}
