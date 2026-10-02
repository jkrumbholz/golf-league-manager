import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { Facility, PlatformService } from '../../services/platform.service';
import { MembershipService } from '../../services/membership.service';
import { ShellComponent } from '../../ui/shell.component';

@Component({
  selector: 'app-admin-league-form',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-league-form.component.html',
})
export class AdminLeagueFormComponent implements OnInit {
  name = '';
  description = '';
  entryFee = 0;
  homeFacilityId: number | null = null;
  facilities: Facility[] = [];
  fieldErrors: Record<string, string> = {};
  error = '';
  saving = false;

  constructor(
    private api: ApiService,
    private platform: PlatformService,
    private membership: MembershipService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.facilities = await this.platform.facilities().catch(() => []);
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    this.error = '';
    if (!this.name.trim()) this.fieldErrors['name'] = 'Give the league a name';
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.saving = true;
    try {
      await this.api.put('league', {
        name: this.name,
        description: this.description,
        entryFee: Number(this.entryFee),
        homeFacilityId: this.homeFacilityId,
      });
      this.membership.clear();
      await this.router.navigate(['/admin/leagues']);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the league';
    } finally {
      this.saving = false;
    }
  }
}
