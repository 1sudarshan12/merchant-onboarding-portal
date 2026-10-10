import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/auth/auth.service';
import { ApplicationChecklist } from '../features/workspace/application-checklist';
import { Icon } from '../shared/ui/icon';

function workspacePageTitle(url: string): string {
  return url.split(/[?#]/)[0] === '/applications' ? 'Applications' : 'Overview';
}

@Component({
  selector: 'app-workspace-shell',
  imports: [MatButtonModule, MatSidenavModule, RouterLink, RouterLinkActive, RouterOutlet, Icon],
  templateUrl: './workspace-shell.html',
  styleUrl: './workspace-shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceShell {
  protected readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);
  protected readonly currentPage = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => workspacePageTitle(event.urlAfterRedirects)),
    ),
    { initialValue: workspacePageTitle(this.router.url) },
  );
  protected readonly isMobile = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 959px)')
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );
  protected readonly navigationOpen = signal(false);

  protected signOut(): void {
    this.dialog.closeAll();
    this.closeNavigation();
    this.auth.logout();
  }

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
