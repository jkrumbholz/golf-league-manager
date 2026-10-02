import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { FORMATS, formatOption } from '../../models/formats';
import { ShellComponent } from '../../ui/shell.component';

@Component({
  selector: 'app-admin-event-form',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-form.component.html',
})
export class AdminEventFormComponent implements OnInit {
  readonly formats = FORMATS;
  seasonId = 0;
  name = '';
  format = 'stroke_play';
  startDate = '';
  endDate = '';
  entryFee = 0;
  teamSize = 2;
  playersPickTeams = false;
  ctpEnabled = false;
  ctpEntryFee = 0;
  longDriveEnabled = false;
  longDriveEntryFee = 0;
  fieldErrors: Record<string, string> = {};
  error = '';
  saving = false;

  constructor(private route: ActivatedRoute, private router: Router, private api: ApiService) {}

  ngOnInit(): void {
    this.seasonId = Number(this.route.snapshot.paramMap.get('seasonId'));
  }

  get backTo(): unknown[] {
    return ['/admin/seasons', this.seasonId];
  }

  get selectedFormat() {
    return formatOption(this.format);
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    this.error = '';
    if (!this.name.trim()) this.fieldErrors['name'] = 'Give the event a name';
    if (!this.startDate) this.fieldErrors['startDate'] = 'Pick a date';
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.saving = true;
    try {
      await this.api.put('event', {
        seasonId: this.seasonId,
        name: this.name,
        format: this.format,
        startDate: this.startDate,
        endDate: this.endDate || this.startDate,
        entryFee: Number(this.entryFee),
        teamSize: this.selectedFormat.teamSize ?? Number(this.teamSize),
        playersPickTeams: this.playersPickTeams,
        ctpEnabled: this.ctpEnabled,
        ctpEntryFee: Number(this.ctpEntryFee),
        longDriveEnabled: this.longDriveEnabled,
        longDriveEntryFee: Number(this.longDriveEntryFee),
      });
      await this.router.navigate(this.backTo);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not create the event';
    } finally {
      this.saving = false;
    }
  }
}
