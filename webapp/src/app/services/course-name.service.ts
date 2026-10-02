import { Injectable } from '@angular/core';
import { PlatformService } from './platform.service';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Resolves platform facility and course-configuration ids to display names. */
@Injectable({ providedIn: 'root' })
export class CourseNameService {
  private names = new Map<number, string>();
  private configurations = new Map<number, string>();
  private loadedFacilities = new Set<number>();
  private loaded = false;

  constructor(private platform: PlatformService) {}

  async preload(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const facilities = await this.platform.facilities();
      facilities.forEach(facility => this.names.set(facility.id, facility.name));
    } catch {
      // Course names are decoration. A failed platform call should not blank the screen.
    }
  }

  /** Loads configuration names for one facility. Later calls for the same facility are free. */
  async ensureConfigurations(facilityId: number | null): Promise<void> {
    if (facilityId == null || this.loadedFacilities.has(facilityId)) return;
    this.loadedFacilities.add(facilityId);
    try {
      const rows = await this.platform.configurations(facilityId);
      rows.forEach(row => this.configurations.set(row.id, row.name));
    } catch {
      this.loadedFacilities.delete(facilityId);
    }
  }

  name(facilityId: number | null): string {
    if (facilityId == null) return '';
    return this.names.get(facilityId) ?? '';
  }

  configurationName(configurationId: number | null): string {
    if (configurationId == null) return '';
    return this.configurations.get(configurationId) ?? '';
  }

  /** "2026-10-08" reads as "Oct 8" on a phone. */
  shortDate(value: string | null): string {
    if (!value) return '';
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return value;
    return `${MONTHS[month - 1]} ${day}`;
  }

  dateRange(start: string | null, end: string | null): string {
    if (!start) return '';
    if (!end || end === start) return this.shortDate(start);
    return `${this.shortDate(start)} – ${this.shortDate(end)}`;
  }
}
