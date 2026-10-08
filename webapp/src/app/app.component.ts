import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigService } from './services/config.service';
import { LoadingService } from './services/loading.service';
import { DrawerComponent } from './ui/drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, DrawerComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  /** Corner ribbon on the dev site. Flip this back on when it should show again. */
  readonly showDevRibbon = false;

  constructor(readonly loading: LoadingService, readonly config: ConfigService) {}
}
