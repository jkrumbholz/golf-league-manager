import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { CourseNameService } from '../../services/course-name.service';
import { ImageService } from '../../services/image.service';
import { ShellComponent } from '../../ui/shell.component';

interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  eventCount: number;
  isActive: boolean;
}

interface Member {
  userId: number;
  firstName: string;
  lastName: string;
  displayName: string;
  role: string;
  handicapIndex: number;
}

@Component({
  selector: 'app-admin-league',
  standalone: true,
  imports: [RouterLink, ShellComponent],
  templateUrl: './admin-league.component.html',
})
export class AdminLeagueComponent implements OnInit {
  leagueId = 0;
  leagueName = '';
  logoImageUrl = '';
  uploading = false;
  logoVisible = true;
  tab: 'seasons' | 'players' = 'seasons';
  seasons: Season[] = [];
  members: Member[] = [];
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    private courseNames: CourseNameService,
    private images: ImageService
  ) {}

  async ngOnInit(): Promise<void> {
    this.leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
    this.route.queryParamMap.subscribe(params => {
      this.tab = params.get('tab') === 'players' ? 'players' : 'seasons';
    });

    try {
      const page = await this.api.post<{
        league: { name: string; logoImageUrl: string | null };
        seasons: Season[];
        members: Member[];
      }>('seasons', { leagueId: this.leagueId });
      this.leagueName = page.league.name;
      this.logoImageUrl = page.league.logoImageUrl || '';
      this.seasons = page.seasons;
      this.members = page.members;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load this league';
    }
  }

  dateRange(season: Season): string {
    return this.courseNames.dateRange(season.startDate, season.endDate);
  }

  memberRole(member: Member): string {
    return member.role === 'organizer' ? 'Organizer' : 'Player';
  }

  async onLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.error = '';
    this.uploading = true;
    try {
      const logoImageUrl = await this.images.uploadLeagueLogo(file, this.leagueId);
      await this.api.put('league', { action: 'setLogo', leagueId: this.leagueId, logoImageUrl });
      this.logoVisible = true;
      this.logoImageUrl = logoImageUrl;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not upload the logo';
    } finally {
      this.uploading = false;
    }
  }

  /** The button under the list means something different on each tab. */
  add(): void {
    const target = this.tab === 'players' ? 'players' : 'seasons';
    void this.router.navigate(['/admin/leagues', this.leagueId, target, 'new']);
  }
}
