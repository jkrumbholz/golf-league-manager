import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from './config.service';

export interface SessionUser {
  id: number;
  username: string;
  firstName: string;
  lastName: string;
  displayName: string;
  handicapIndex: number;
  profilePictureUrl: string | null;
}

interface Session {
  token: string;
  user: SessionUser;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly storageKey = 'golf-league-manager.session';
  private current: Session | null = this.read();

  constructor(private http: HttpClient, private config: ConfigService) {}

  token(): string | null {
    return this.current?.token ?? null;
  }

  user(): SessionUser | null {
    return this.current?.user ?? null;
  }

  isAuthenticated(): boolean {
    return !!this.current?.token;
  }

  async login(username: string, password: string): Promise<boolean> {
    const result = await firstValueFrom(this.http.post<{ isSuccess: boolean; token?: string; user?: SessionUser }>(
      `${this.config.leagueApi()}/login`,
      { username, password }
    ));
    if (!result.isSuccess || !result.token || !result.user) return false;
    this.persist({ token: result.token, user: result.user });
    return true;
  }

  async register(body: { username: string; password: string; firstName: string; lastName: string; handicapIndex: number }): Promise<void> {
    const result = await firstValueFrom(this.http.post<{ isSuccess: boolean; token: string; user: SessionUser }>(
      `${this.config.leagueApi()}/register`,
      body
    ));
    this.persist({ token: result.token, user: result.user });
  }

  async logout(): Promise<void> {
    const token = this.token();
    this.current = null;
    localStorage.removeItem(this.storageKey);
    if (!token) return;
    await firstValueFrom(this.http.post(`${this.config.leagueApi()}/logout`, { token })).catch(() => undefined);
  }

  replaceUser(user: SessionUser): void {
    if (!this.current) return;
    this.persist({ token: this.current.token, user });
  }

  private persist(session: Session): void {
    this.current = session;
    localStorage.setItem(this.storageKey, JSON.stringify(session));
  }

  private read(): Session | null {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }
}
