import { Component, OnInit } from '@angular/core';
import { ShellComponent } from '../../ui/shell.component';
import { AdminEventScreen } from './admin-event-screen';

@Component({
  selector: 'app-admin-event-share',
  standalone: true,
  imports: [ShellComponent],
  templateUrl: './admin-event-share.component.html',
})
export class AdminEventShareComponent extends AdminEventScreen implements OnInit {
  copied = false;

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  get signupUrl(): string {
    if (!this.dashboard) return '';
    return `${location.origin}/signup/${this.dashboard.event.signupToken}`;
  }

  get boardUrl(): string {
    return `${location.origin}/leaderboard/${this.eventId}`;
  }

  async copy(value: string): Promise<void> {
    await navigator.clipboard.writeText(value);
    this.copied = true;
  }
}
