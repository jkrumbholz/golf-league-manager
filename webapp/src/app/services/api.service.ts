import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { LoadingService } from './loading.service';

export interface RequestOptions {
  /** Background refresh. Does not show the loading bar. */
  quiet?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private config: ConfigService,
    private loading: LoadingService
  ) {}

  post<T>(path: string, body: object = {}, options?: RequestOptions): Promise<T> {
    return this.send<T>('POST', path, body, options);
  }

  put<T>(path: string, body: object = {}, options?: RequestOptions): Promise<T> {
    return this.send<T>('PUT', path, body, options);
  }

  delete<T>(path: string, body: object = {}, options?: RequestOptions): Promise<T> {
    return this.send<T>('DELETE', path, body, options);
  }

  private send<T>(method: string, path: string, body: object, options?: RequestOptions): Promise<T> {
    const work = this.request<T>(method, path, body);
    return options?.quiet ? work : this.loading.track(work);
  }

  private async request<T>(method: string, path: string, body: object): Promise<T> {
    const base = this.config.leagueApi();
    try {
      return await firstValueFrom(this.http.request<T>(method, `${base}/${path}`, {
        body: { ...body, token: this.auth.token() },
      }));
    } catch (error: unknown) {
      const response = error as { error?: { error?: string }; message?: string };
      throw new Error(response.error?.error || response.message || 'Request failed');
    }
  }
}
