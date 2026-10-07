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
  constructor(readonly loading: LoadingService, readonly config: ConfigService) {}
}
