import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EMPTY, map, switchMap, timeout } from 'rxjs';
import type { ApplicationDetail, Decision, RiskLevel, User } from '../../../../shared/models';
import { AuthService } from '../../core/auth/auth.service';
import { Icon } from '../../shared/ui/icon';
import { ApplicationDetailApi } from './application-detail.api';

type DecisionForm = FormGroup<{
  decision: FormControl<Decision>;
  riskLevel: FormControl<RiskLevel>;
  note: FormControl<string>;
}>;

@Component({
  selector: 'app-application-detail',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    Icon,
  ],
  templateUrl: './application-detail.html',
  styleUrl: './application-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationDetailPage {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApplicationDetailApi);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly detail = signal<ApplicationDetail | null>(null);
  protected readonly reviewers = signal<User[]>([]);
  protected readonly error = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly revealing = signal(false);
  protected readonly revealed = signal<{ accountNumber: string; taxId: string } | null>(null);
  protected readonly selectedReviewer = signal('');
  protected readonly role = computed(() => this.auth.user()?.role ?? null);
  protected readonly canAssign = computed(
    () =>
      this.role() === 'ADMIN' && ['SUBMITTED', 'IN_REVIEW'].includes(this.detail()?.status ?? ''),
  );
  protected readonly canReview = computed(
    () =>
      this.role() === 'REVIEWER' &&
      this.detail()?.status === 'IN_REVIEW' &&
      this.detail()?.assignedReviewerId === this.auth.user()?.id,
  );
  protected readonly canReveal = computed(
    () =>
      (this.role() === 'ADMIN' || this.canReview()) &&
      Boolean(
        this.detail()?.sensitive.accountNumber.present || this.detail()?.sensitive.taxId.present,
      ),
  );

  protected readonly decisionForm: DecisionForm = new FormGroup({
    decision: new FormControl<Decision>('APPROVE', { nonNullable: true }),
    riskLevel: new FormControl<RiskLevel>('MEDIUM', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
  });

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        switchMap((id) => {
          if (!id) return EMPTY;
          this.loading.set(true);
          this.error.set('');
          this.revealed.set(null);
          return this.api.get(id).pipe(timeout(15_000));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.selectedReviewer.set(detail.assignedReviewerId ?? '');
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('This application could not be loaded. Check your access and try again.');
        },
      });
  }

  protected load(): void {
    const id = this.detail()?.id;
    if (!id) return;
    this.loading.set(true);
    this.error.set('');
    this.api
      .get(id)
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.selectedReviewer.set(detail.assignedReviewerId ?? '');
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set('This application could not be loaded. Check your access and try again.');
        },
      });
  }

  protected openReviewers(): void {
    if (this.reviewers().length > 0) return;
    this.api
      .reviewers()
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (reviewers) => this.reviewers.set(reviewers),
        error: () => this.error.set('Reviewer options could not be loaded.'),
      });
  }

  protected assign(): void {
    const detail = this.detail();
    const reviewerId = this.selectedReviewer();
    if (!detail || !reviewerId || this.busy()) return;
    this.busy.set(true);
    this.api
      .assign(detail.id, { version: detail.version, reviewerId })
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.detail.set(updated);
          this.busy.set(false);
        },
        error: (error) => {
          this.busy.set(false);
          this.error.set(
            error?.status === 409
              ? 'This application changed. Reload before assigning it.'
              : 'Assignment could not be saved.',
          );
        },
      });
  }

  protected decide(): void {
    const detail = this.detail();
    if (!detail || this.decisionForm.invalid || this.busy()) {
      this.decisionForm.markAllAsTouched();
      return;
    }
    const { decision, riskLevel, note } = this.decisionForm.getRawValue();
    if (decision === 'REJECT' && !note.trim()) {
      this.decisionForm.controls.note.setErrors({ required: true });
      this.decisionForm.controls.note.markAsTouched();
      return;
    }
    this.busy.set(true);
    this.api
      .decide(detail.id, { version: detail.version, decision, riskLevel, note: note.trim() })
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.detail.set(updated);
          this.busy.set(false);
        },
        error: (error) => {
          this.busy.set(false);
          this.error.set(
            error?.status === 409
              ? 'This application changed. Reload before deciding.'
              : 'The decision could not be saved.',
          );
        },
      });
  }

  protected revealSensitive(): void {
    const id = this.detail()?.id;
    if (!id || this.revealing() || !this.canReveal()) return;
    this.revealing.set(true);
    this.api
      .reveal(id)
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (values) => {
          this.revealed.set(values);
          this.revealing.set(false);
        },
        error: () => {
          this.revealing.set(false);
          this.error.set('Sensitive banking values could not be revealed.');
        },
      });
  }

  protected clearReveal(): void {
    this.revealed.set(null);
  }
}
