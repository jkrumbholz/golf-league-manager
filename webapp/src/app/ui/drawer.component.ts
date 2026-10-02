import { Component, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { NavService } from './nav.service';

@Component({
  selector: 'app-drawer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './drawer.component.html',
})
export class DrawerComponent implements OnDestroy {
  open = false;
  organizer = false;
  private subscriptions = new Subscription();

  constructor(
    private navService: NavService,
    private membership: MembershipService,
    public auth: AuthService,
    private router: Router
  ) {
    this.subscriptions.add(this.navService.drawerOpen.subscribe(async open => {
      this.open = open;
      if (open) this.organizer = await this.membership.isOrganizer();
    }));
    this.subscriptions.add(
      this.router.events
        .pipe(filter(event => event instanceof NavigationEnd))
        .subscribe(() => this.navService.close())
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  close(): void {
    this.navService.close();
  }

  hideImage(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  async logout(): Promise<void> {
    this.close();
    this.membership.clear();
    await this.auth.logout();
    await this.router.navigateByUrl('/login');
  }
}
