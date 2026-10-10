import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { safeReturnUrl } from '../../core/auth/auth.guard';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly form = inject(NonNullableFormBuilder).group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly pending = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly expired = this.route.snapshot.queryParamMap.get('reason') === 'expired';
  protected readonly demoAccounts = [
    { label: 'Sales', email: 'sales1@example.test', description: 'Prepare merchant applications' },
    {
      label: 'Reviewer',
      email: 'reviewer1@example.test',
      description: 'Assess assigned applications',
    },
    { label: 'Admin', email: 'admin@example.test', description: 'Coordinate review assignments' },
  ];

  protected fillDemo(email: string): void {
    if (this.pending()) return;
    // Public demo credential, intentionally documented in the interface and README.
    this.form.reset({ email, password: 'Demo#1234' });
    this.passwordVisible.set(false);
    this.error.set(null);
  }

  protected submit(): void {
    if (this.pending()) return;
    this.form.controls.email.setValue(this.form.controls.email.value.trim());
    this.form.markAllAsTouched();
    this.error.set(null);
    if (this.form.invalid) return;

    this.pending.set(true);
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        finalize(() => this.pending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void this.router.navigateByUrl(
            safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl')),
            { replaceUrl: true },
          );
        },
        error: (error: unknown) => {
          this.error.set(
            error instanceof HttpErrorResponse && error.status === 401
              ? 'Email or password is incorrect. Check your details and try again.'
              : 'Unable to sign in. Check your connection and try again.',
          );
        },
      });
  }
}
