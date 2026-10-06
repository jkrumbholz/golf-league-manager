import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  username = '';
  password = '';
  error = '';

  constructor(
    private auth: AuthService,
    private membership: MembershipService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  async submit(): Promise<void> {
    this.error = '';
    try {
      const ok = await this.auth.login(this.username, this.password);
      if (!ok) {
        this.error = 'Username or password did not match.';
        return;
      }
      this.membership.clear();
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/leagues';
      await this.router.navigateByUrl(returnUrl);
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Sign in failed';
    }
  }
}
