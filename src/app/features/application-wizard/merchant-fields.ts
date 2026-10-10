import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { type AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { merge } from 'rxjs';
import type { ApplicationDetail } from '../../../../shared/models';
import type { MerchantFormGroup } from './merchant-form';

@Component({
  selector: 'app-merchant-fields',
  imports: [
    ReactiveFormsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  providers: [
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { subscriptSizing: 'dynamic' } },
  ],
  templateUrl: './merchant-fields.html',
  styleUrl: './merchant-fields.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MerchantFields {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly form = input.required<MerchantFormGroup>();
  readonly step = input.required<number>();
  readonly sensitive = input.required<ApplicationDetail['sensitive']>();
  readonly serverErrors = input<Record<string, string>>({});

  constructor() {
    effect((onCleanup) => {
      const form = this.form();
      const controls: AbstractControl[] = [form];
      for (const section of Object.values(form.controls)) {
        controls.push(section, ...Object.values(section.controls));
      }
      // markAllAsTouched emits on each control without bubbling to the root form.
      const subscription = merge(...controls.map((control) => control.events)).subscribe(() => {
        this.changeDetector.markForCheck();
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected error(path: string): string {
    const control = this.form().get(path);
    const serverError = this.serverErrors()[path];
    if (serverError) return serverError;
    if (!control?.touched || !control.invalid) return '';
    const controlServerError: unknown = control.getError('server');
    if (typeof controlServerError === 'string') return controlServerError;
    if (control.hasError('required')) return 'This field is required.';
    if (control.hasError('minlength')) return 'Use at least 2 characters.';
    if (control.hasError('maxlength')) return 'Use 500 characters or fewer.';
    if (control.hasError('email')) return 'Enter a valid email address.';
    if (control.hasError('phone')) return 'Use 7–15 digits, with optional spaces and a leading +.';
    if (control.hasError('website')) return 'Enter a complete HTTP or HTTPS website address.';
    if (control.hasError('finite')) return 'Enter a valid number.';
    if (control.hasError('positive')) return 'Enter an amount greater than zero.';
    if (control.hasError('max')) return 'Enter an amount no greater than 1,000,000,000,000.';
    if (control.hasError('pattern')) {
      switch (path) {
        case 'business.registrationNumber':
          return 'Use 6–20 letters, digits, or hyphens.';
        case 'business.businessType':
          return 'Choose a business type.';
        case 'banking.accountNumber':
          return 'Use 8–17 digits.';
        case 'banking.taxId':
          return 'Use exactly 9 digits.';
      }
    }
    return 'Check this value and try again.';
  }

  protected processingError(key: 'averageExceedsMax' | 'maxExceedsMonthly'): boolean {
    const processing = this.form().controls.processing;
    return processing.touched && processing.hasError(key);
  }
}
