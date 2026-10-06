import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';

interface LinkPreview {
  purpose: 'setup' | 'reset';
  displayName: string;
  username: string | null;
}

@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent implements OnInit {
  token = '';
  preview: LinkPreview | null = null;
  username = '';
  password = '';
  confirm = '';
  fieldErrors: Record<string, string> = {};
  error = '';
  done = false;
  saving = false;

  constructor(private route: ActivatedRoute, private api: ApiService) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    try {
      this.preview = await this.api.post<LinkPreview>('accountlink', { token: this.token });
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'This link is not valid';
    }
  }

  get setup(): boolean {
    return this.preview?.purpose === 'setup';
  }

  async save(): Promise<void> {
    this.fieldErrors = {};
    this.error = '';
    if (this.setup && !/^[a-z0-9._-]{3,40}$/i.test(this.username.trim())) {
      this.fieldErrors['username'] = 'Use 3 to 40 letters, numbers, dots, or dashes';
    }
    if (this.password.length < 8) this.fieldErrors['password'] = 'Use at least 8 characters';
    if (this.password !== this.confirm) this.fieldErrors['confirm'] = 'Those passwords do not match';
    if (Object.keys(this.fieldErrors).length > 0) return;

    this.saving = true;
    try {
      await this.api.post('accountlink', {
        token: this.token,
        username: this.username,
        password: this.password,
      });
      this.done = true;
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not save that login';
    } finally {
      this.saving = false;
    }
  }
}
