import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { ShellComponent } from '../ui/shell.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, ShellComponent],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  username = '';
  password = '';
  firstName = '';
  lastName = '';
  handicapIndex = 0;
  error = '';

  constructor(private auth: AuthService, private router: Router) {}

  async submit(): Promise<void> {
    this.error = '';
    try {
      await this.auth.register({
        username: this.username,
        password: this.password,
        firstName: this.firstName,
        lastName: this.lastName,
        handicapIndex: Number(this.handicapIndex),
      });
      await this.router.navigateByUrl('/leagues');
    } catch (error: unknown) {
      this.error = error instanceof Error ? error.message : 'Could not create the account';
    }
  }
}
