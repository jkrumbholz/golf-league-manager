import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NavService {
  readonly drawerOpen = new BehaviorSubject<boolean>(false);

  open(): void {
    this.drawerOpen.next(true);
  }

  close(): void {
    this.drawerOpen.next(false);
  }
}
