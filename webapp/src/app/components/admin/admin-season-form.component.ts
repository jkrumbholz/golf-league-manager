import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ShellComponent } from '../../ui/shell.component';

@Component({
  selector: 'app-admin-season-form',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-season-form.component.html',
})
export class AdminSeasonFormComponent implements OnInit {
  leagueId = 0;
  name = '';
  startDate = '';
  endDate = '';
  fieldErrors: Record<string, string> = {};
  error = '';
  saving = false;

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    this.leagueId = Number(this.route.snapshot.paramMap.get('leagueId'));
  }

  get backTo(): unknown[] {
    return ['/admin/leagues', this.leagueId];
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    this.error = '';
    if (!this.name.trim()) this.fieldErrors['name'] = 'Give the season a name';
    if (!this.startDate) this.fieldErrors['startDate'] = 'Pick a start date';
    if (!this.endDate) this.fieldErrors['endDate'] = 'Pick an end date';
    if (this.startDate && this.endDate && this.endDate < this.startDate) {
      this.fieldErrors['endDate'] = 'The end date comes before the start date';
    }
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.saving = true;
    try {
      await this.api.put('season', {
        leagueId: this.leagueId,
        name: this.name,
        startDate: this.startDate,
        endDate: this.endDate,
      });
      await this.router.navigate(this.backTo);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the season';
    } finally {
      this.saving = false;
    }
  }
}
