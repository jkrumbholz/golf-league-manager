import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  environment: string = environment.name;

  leagueApi(): string {
    return environment.apiEndpoint.replace(/\/$/, '');
  }

  platformApi(): string {
    return environment.platformApiEndpoint.replace(/\/$/, '');
  }

  leaderboardRefreshMs(): number {
    return environment.leaderboardRefreshSeconds * 1000;
  }

  isProdEnvironment(): boolean {
    return environment.name === 'prod';
  }
}
