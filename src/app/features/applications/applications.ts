import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import type { ApplicationSummary } from '../../../../shared/models';
import { canEditApplication } from '../../../../shared/permissions';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/ui/icon';
import { STATUS_LABELS, STATUS_OPTIONS } from './application-list';
import { ApplicationsStore } from './applications.store';

@Component({
  selector: 'app-applications',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    RouterLink,
    Icon,
  ],
  providers: [ApplicationsStore],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Applications {
  protected readonly store = inject(ApplicationsStore);
  private readonly auth = inject(AuthService);
  protected readonly search = new FormControl(this.store.query().search, { nonNullable: true });
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly canCreate = computed(() => this.auth.user()?.role === 'SALES');
  protected readonly hasFilters = computed(
    () => this.store.query().search.trim().length > 0 || this.store.query().status !== '',
  );
  protected readonly scopeDescription = computed(() => {
    switch (this.auth.user()?.role) {
      case 'SALES':
        return 'Showing applications created by you.';
      case 'REVIEWER':
        return 'Showing applications assigned to you.';
      case 'ADMIN':
        return 'Showing applications across the team.';
      default:
        return 'Showing applications you have permission to view.';
    }
  });

  constructor() {
    this.search.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.store.setSearch(value);
    });
  }

  protected canEdit(application: ApplicationSummary): boolean {
    const user = this.auth.user();
    return user !== null && canEditApplication(user, application);
  }

  protected clearSearch(input: HTMLInputElement): void {
    input.focus();
    this.search.setValue('');
  }

  protected clearFilters(input: HTMLInputElement): void {
    input.focus();
    this.search.setValue('', { emitEvent: false });
    this.store.clearFilters();
  }

  protected retry(results: HTMLElement): void {
    results.focus();
    this.store.reload();
  }

  protected firstPage(results: HTMLElement): void {
    results.focus();
    this.store.setPage(0, this.store.query().pageSize);
  }
}
