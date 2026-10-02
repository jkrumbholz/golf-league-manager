import { Injectable } from '@angular/core';
import { ApiService } from './api.service';

export interface LeagueSummary {
  id: number;
  name: string;
  description: string | null;
  role: string;
  entryFee: number;
  currentSeasonName: string | null;
  logoImageUrl: string | null;
  seasonCount: number;
  playerCount: number;
  liveEventId: number | null;
}

/** Caches the signed-in player's leagues so the drawer and guards do not refetch. */
@Injectable({ providedIn: 'root' })
export class MembershipService {
  private cached: LeagueSummary[] | null = null;

  constructor(private api: ApiService) {}

  async leagues(refresh = false): Promise<LeagueSummary[]> {
    if (!this.cached || refresh) {
      this.cached = await this.api.post<LeagueSummary[]>('leagues');
    }
    return this.cached;
  }

  async isOrganizer(): Promise<boolean> {
    try {
      const leagues = await this.leagues();
      return leagues.some(league => league.role === 'organizer');
    } catch {
      return false;
    }
  }

  clear(): void {
    this.cached = null;
  }
}
