import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';
import { LoadingService } from './loading.service';

export interface Facility {
  id: number;
  name: string;
  city: string | null;
  stateCode: string | null;
}

export interface PlayingConfiguration {
  id: number;
  facilityId: number;
  name: string;
  holeCount: number | null;
}

export interface TeeSet {
  id: number;
  name: string;
  hexColorCode: string | null;
  displayOrder: number | null;
}

export interface HoleTee {
  holeId: number;
  teeSetId: number;
  par: number | null;
  handicapIndex: number | null;
}

export interface ConfigurationNine {
  configurationId: number;
  nineId: number;
  sequenceNumber: number | null;
}

export interface NineHole {
  nineId: number;
  holeId: number;
  teeSetId: number | null;
  sequence: number | null;
  displayHoleNumber: number | null;
  defaultPar: number | null;
}

export interface DraftTee {
  platformTeeSetId: number;
  name: string;
  hexColorCode: string | null;
  ladderOrder: number;
}

export interface DraftHole {
  sequence: number;
  platformHoleId: number;
  displayHoleNumber: number | null;
  par: number;
  strokeIndex: number | null;
  platformTeeSetId: number;
}

@Injectable({ providedIn: 'root' })
export class PlatformService {
  constructor(private http: HttpClient, private config: ConfigService, private loading: LoadingService) {}

  facilities(): Promise<Facility[]> {
    return this.post<Facility[]>('golffacilities', { pageNumber: 1, pageSize: 200 });
  }

  configurations(facilityId: number): Promise<PlayingConfiguration[]> {
    return this.post<PlayingConfiguration[]>('golfconfigurations', { facilityId });
  }

  async course(facilityId: number, configurationId: number): Promise<{ tees: DraftTee[]; holes: DraftHole[]; holeTees: HoleTee[] }> {
    const [teeSets, holeTees, configNines] = await Promise.all([
      this.post<TeeSet[]>('teesets', { facilityId }),
      this.post<HoleTee[]>('holetees', { facilityId }),
      this.post<ConfigurationNine[]>('golfconfigurationnines', { facilityId }),
    ]);

    const nines = configNines
      .filter(row => row.configurationId === configurationId)
      .sort((a, b) => (a.sequenceNumber ?? 0) - (b.sequenceNumber ?? 0));

    const memberships: NineHole[] = [];
    for (const nine of nines) {
      const holes = await this.post<NineHole[]>('holememberships', { nineId: nine.nineId });
      memberships.push(...holes.sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0)));
    }

    const orderedTees = [...teeSets].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
    const tees: DraftTee[] = orderedTees.map((tee, index) => ({
      platformTeeSetId: tee.id,
      name: tee.name,
      hexColorCode: tee.hexColorCode,
      ladderOrder: index + 1,
    }));
    const blue = tees.find(tee => tee.name.toLowerCase() === 'blue') ?? tees[0];

    const holes: DraftHole[] = memberships.map((hole, index) => {
      const platformTeeSetId = hole.teeSetId ?? blue?.platformTeeSetId ?? 0;
      const details = holeTees.find(item => item.holeId === hole.holeId && item.teeSetId === platformTeeSetId);
      return {
        sequence: index + 1,
        platformHoleId: hole.holeId,
        displayHoleNumber: hole.displayHoleNumber,
        par: details?.par ?? hole.defaultPar ?? 4,
        strokeIndex: details?.handicapIndex ?? null,
        platformTeeSetId,
      };
    });

    return { tees, holes, holeTees };
  }

  private post<T>(path: string, body: object): Promise<T> {
    return this.loading.track(firstValueFrom(this.http.post<T>(`${this.config.platformApi()}/${path}`, body)));
  }
}
