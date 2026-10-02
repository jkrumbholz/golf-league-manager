import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NavService } from './nav.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './shell.component.html',
})
export class ShellComponent {
  /** Left side of the header. Drill-in screens use back, forms use close. */
  @Input() nav: 'none' | 'back' | 'close' = 'none';
  /** Right side of the header. The menu is always shown. Add sits beside it. */
  @Input() action: 'none' | 'menu' | 'add' = 'menu';
  @Input() title = '';
  @Input() backTo: unknown[] = ['/leagues'];
  @Input() queryParams: Record<string, string> | null = null;
  @Input() addLabel = '+ Add';
  @Output() add = new EventEmitter<void>();

  constructor(private navService: NavService) {}

  openMenu(): void {
    this.navService.open();
  }
}
