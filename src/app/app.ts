import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenavModule } from '@angular/material/sidenav';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { ApplicationChecklist } from './features/workspace/application-checklist';
import { Icon } from './shared/ui/icon';

@Component({
  selector: 'app-root',
  imports: [MatButtonModule, MatSidenavModule, RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly dialog = inject(MatDialog);
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly navigationOpen = signal(false);

  protected closeNavigation(): void {
    this.navigationOpen.set(false);
  }

  protected focusMainContent(event: Event, main: HTMLElement): void {
    // A plain fragment resolves against Angular's base URL, which can leave the current route.
    event.preventDefault();
    main.focus();
  }

  protected openChecklist(): void {
    this.dialog.open(ApplicationChecklist, {
      width: '560px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
    });
  }
}
