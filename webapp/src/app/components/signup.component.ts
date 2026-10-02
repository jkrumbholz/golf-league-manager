import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

interface SignupEvent {
  id: number;
  name: string;
  leagueName: string;
  formatLabel: string;
  entryFee: number;
  startDate: string;
  endDate: string;
  ctpEnabled: boolean;
  ctpEntryFee: number;
  longDriveEnabled: boolean;
  longDriveEntryFee: number;
}

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './signup.component.html',
})
export class SignupComponent implements OnInit {
  token = '';
  event: SignupEvent | null = null;
  ctpEntered = false;
  longDriveEntered = false;
  error = '';
  done = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService,
    public auth: AuthService
  ) {}

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.paramMap.get('token') || '';
    try {
      this.event = await this.api.post<SignupEvent>('eventsignup', { signupToken: this.token });
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'This signup link did not work';
    }
  }

  loginLink(): string {
    return `/login?returnUrl=${encodeURIComponent(this.router.url)}`;
  }

  async signup(): Promise<void> {
    this.error = '';
    try {
      const result = await this.api.put<{ eventId: number }>('registration', {
        signupToken: this.token,
        ctpEntered: this.ctpEntered,
        longDriveEntered: this.longDriveEntered,
      });
      this.done = true;
      await this.router.navigate(['/events', result.eventId]);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not sign up';
    }
  }
}
