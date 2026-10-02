import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  DraftHole,
  DraftTee,
  Facility,
  HoleTee,
  PlatformService,
  PlayingConfiguration,
} from '../../services/platform.service';
import { formatOption } from '../../models/formats';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-course',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './admin-event-course.component.html',
})
export class AdminEventCourseComponent extends AdminEventScreen implements OnInit {
  private platform = inject(PlatformService);
  private router = inject(Router);

  facilities: Facility[] = [];
  configurations: PlayingConfiguration[] = [];
  facilityId: number | null = null;
  configurationId: number | null = null;
  playDate = '';
  roundId: number | null = null;
  draftTees: DraftTee[] = [];
  draftHoles: DraftHole[] = [];
  holeTees: HoleTee[] = [];

  async ngOnInit(): Promise<void> {
    this.facilities = await this.platform.facilities().catch(() => []);
    await this.load();
    if (!this.dashboard) return;
    this.facilityId = this.dashboard.event.facilityId;
    this.configurationId = this.dashboard.event.courseConfigurationId;
    this.playDate = this.dashboard.rounds[0]?.playDate || this.dashboard.event.startDate;
    this.roundId = this.dashboard.rounds[0]?.id ?? null;
    if (this.facilityId) {
      this.configurations = await this.platform.configurations(this.facilityId).catch(() => []);
    }
  }

  get runningTee(): boolean {
    return formatOption(this.dashboard?.event.format || '').runningTee;
  }

  async onFacilityChange(): Promise<void> {
    this.configurationId = null;
    this.draftHoles = [];
    this.configurations = this.facilityId ? await this.platform.configurations(this.facilityId) : [];
  }

  async loadCourse(): Promise<void> {
    if (!this.facilityId || !this.configurationId) return;
    this.error = '';
    try {
      const course = await this.platform.course(this.facilityId, this.configurationId);
      this.draftTees = course.tees;
      this.draftHoles = course.holes;
      this.holeTees = course.holeTees;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not load the course';
    }
  }

  teeChanged(hole: DraftHole): void {
    const details = this.holeTees.find(
      item => item.holeId === hole.platformHoleId && item.teeSetId === hole.platformTeeSetId
    );
    if (!details) return;
    hole.par = details.par ?? hole.par;
    hole.strokeIndex = details.handicapIndex;
  }

  setStartingTee(platformTeeSetId: number | string): void {
    const teeId = Number(platformTeeSetId);
    for (const hole of this.draftHoles) {
      hole.platformTeeSetId = teeId;
      this.teeChanged(hole);
    }
  }

  moveTee(index: number, direction: number): void {
    const next = index + direction;
    if (next < 0 || next >= this.draftTees.length) return;
    const copy = [...this.draftTees];
    const [tee] = copy.splice(index, 1);
    copy.splice(next, 0, tee);
    this.draftTees = copy.map((item, order) => ({ ...item, ladderOrder: order + 1 }));
  }

  /** Clearing the round id makes the next save create a second round instead of replacing the first. */
  newRound(): void {
    this.roundId = null;
    this.draftHoles = [];
    this.draftTees = [];
  }

  async save(): Promise<void> {
    this.error = '';
    this.busy = true;
    try {
      await this.api.put('round', {
        eventId: this.eventId,
        roundId: this.roundId,
        playDate: this.playDate,
        courseConfigurationId: this.configurationId,
        facilityId: this.facilityId,
        teeSets: this.draftTees,
        holes: this.draftHoles,
      });
      await this.router.navigate(['/admin/events', this.eventId]);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save the course';
    } finally {
      this.busy = false;
    }
  }
}
