import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type AbstractControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { distinctUntilChanged, firstValueFrom, map, Subscription, timeout } from 'rxjs';
import type { ApplicationDetail } from '../../../../shared/models';
import { canEditApplication } from '../../../../shared/permissions';
import { AuthService } from '../../core/auth/auth.service';
import { PendingChanges } from '../../core/auth/pending-changes';
import { DraftApi } from './draft.api';
import { DraftAutosave } from './draft-autosave';
import { DraftExitDialog, type DraftExitChoice } from './draft-exit-dialog';
import {
  createMerchantForm,
  draftCanSave,
  draftSnapshot,
  restoreMerchantForm,
} from './merchant-form';
import { MerchantFields } from './merchant-fields';

const EMPTY_SENSITIVE: ApplicationDetail['sensitive'] = {
  accountNumber: { present: false, masked: '' },
  taxId: { present: false, masked: '' },
};

@Component({
  selector: 'app-application-wizard',
  imports: [ReactiveFormsModule, MatButtonModule, RouterLink, MerchantFields],
  providers: [DraftAutosave],
  templateUrl: './application-wizard.html',
  styleUrl: './application-wizard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationWizard {
  protected readonly autosave = inject(DraftAutosave);
  private readonly api = inject(DraftApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly injector = inject(Injector);
  private readonly stepHeading = viewChild<ElementRef<HTMLElement>>('stepHeading');
  private readonly pageHeading = viewChild<ElementRef<HTMLElement>>('pageHeading');
  private request?: Subscription;
  private exitRequest: Promise<boolean> | null = null;
  private readonly revision = signal(0);
  protected readonly phase = signal<'new' | 'loading' | 'ready' | 'error' | 'blocked'>('loading');
  protected readonly pageError = signal('');
  protected readonly creating = signal(false);
  protected readonly step = signal(0);
  protected readonly validationNotice = signal('');
  protected readonly steps = ['Business', 'Contact', 'Banking', 'Processing', 'Review'];
  protected readonly sensitive = computed(
    () => this.autosave.detail()?.sensitive ?? EMPTY_SENSITIVE,
  );
  protected readonly form = createMerchantForm(() => ({
    accountNumber: this.sensitive().accountNumber.present,
    taxId: this.sensitive().taxId.present,
  }));
  protected readonly saveable = computed(() => {
    this.revision();
    return draftCanSave(this.form);
  });
  protected readonly values = computed(() => {
    this.revision();
    return this.form.getRawValue();
  });
  protected readonly saveLabel = computed(() => {
    if (this.autosave.isSubmitting()) return 'Saving and submitting…';
    const labels = {
      saved: 'All changes saved',
      unsaved: 'Unsaved changes',
      saving: 'Saving changes…',
      error: 'Save needs attention',
      conflict: 'Saving paused: conflict',
    };
    return labels[this.autosave.state()];
  });
  protected readonly reviewSections = computed(() => {
    const value = this.values();
    const secret = (
      raw: string,
      saved: { present: boolean; masked: string },
      dirty: boolean,
    ): string =>
      dirty
        ? raw
          ? `•••• ${raw.length > 4 ? raw.slice(-4) : ''}`
          : 'Not provided'
        : saved.masked || 'Not provided';
    return [
      {
        title: 'Business',
        fields: [
          ['Legal name', value.business.legalName],
          ['Trading name', value.business.tradingName || 'Not provided'],
          ['Registration', value.business.registrationNumber],
          ['Business type', value.business.businessType.replace('_', ' ').toLowerCase()],
          ['Industry', value.business.industry],
          ['Website', value.business.website || 'Not provided'],
        ],
      },
      {
        title: 'Contact',
        fields: [
          ['Full name', value.contact.fullName],
          ['Email', value.contact.email],
          ['Phone', value.contact.phone],
          ['Address', value.contact.addressLine],
          ['City', value.contact.city],
          ['Postal code', value.contact.postalCode],
        ],
      },
      {
        title: 'Banking',
        fields: [
          ['Bank', value.banking.bankName],
          [
            'Account number',
            secret(
              value.banking.accountNumber,
              this.sensitive().accountNumber,
              this.form.controls.banking.controls.accountNumber.dirty,
            ),
          ],
          [
            'Tax ID',
            secret(
              value.banking.taxId,
              this.sensitive().taxId,
              this.form.controls.banking.controls.taxId.dirty,
            ),
          ],
        ],
      },
      {
        title: 'Processing',
        fields: [
          ['Monthly volume', String(value.processing.monthlyVolume ?? '')],
          ['Average ticket', String(value.processing.averageTicket ?? '')],
          ['Maximum ticket', String(value.processing.maxTicket ?? '')],
          ['International payments', value.processing.acceptsInternational ? 'Yes' : 'No'],
        ],
      },
    ];
  });

  constructor() {
    // Validators survive Material/FormControlName setup when a previously hidden
    // step is mounted. Imperative setErrors alone is erased by that revalidation.
    const fields: Array<[string, AbstractControl]> = Object.entries(this.form.controls).flatMap(
      ([section, group]) =>
        Object.entries(group.controls).map(
          ([name, control]) => [`${section}.${name}`, control] as [string, AbstractControl],
        ),
    );
    for (const [path, control] of fields) {
      control.addValidators(() => {
        const message = this.autosave.fieldErrors()[path];
        return message ? { server: message } : null;
      });
    }
    const unregister = inject(PendingChanges).register(() => this.canLeave());
    this.destroyRef.onDestroy(unregister);
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.step.set(0);
        if (id) this.load(id);
        else this.phase.set('new');
      });
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.revision.update((value) => value + 1);
      this.validationNotice.set('');
      if (this.phase() === 'ready')
        this.autosave.queue(draftSnapshot(this.form), draftCanSave(this.form));
    });
    effect(() => {
      this.sensitive();
      this.form.controls.banking.controls.accountNumber.updateValueAndValidity({
        emitEvent: false,
      });
      this.form.controls.banking.controls.taxId.updateValueAndValidity({ emitEvent: false });
    });
    effect(() => {
      const errors = this.autosave.fieldErrors();
      for (const [path, control] of fields) {
        control.updateValueAndValidity({ emitEvent: false });
        if (errors[path]) control.markAsTouched();
      }
    });
  }

  protected create(): void {
    if (this.creating()) return;
    this.creating.set(true);
    this.pageError.set('');
    this.api
      .create()
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => {
          this.creating.set(false);
          void this.router.navigate(['/applications', draft.id, 'edit'], { replaceUrl: true });
        },
        error: () => {
          this.creating.set(false);
          this.pageError.set(
            'Draft creation could not be confirmed. Check Applications before trying again in case the server created it.',
          );
        },
      });
  }

  protected load(id = this.route.snapshot.paramMap.get('id')): void {
    if (!id) return;
    this.request?.unsubscribe();
    this.phase.set('loading');
    this.pageError.set('');
    this.request = this.api
      .get(id)
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          const user = this.auth.user();
          if (!user || !canEditApplication(user, detail)) {
            this.phase.set('blocked');
            this.pageError.set('This application is not an editable draft for your account.');
            return;
          }
          // Presence must be available before the form validates its blank secret controls.
          this.autosave.initialize(detail, {});
          restoreMerchantForm(this.form, detail);
          this.autosave.initialize(detail, draftSnapshot(this.form));
          this.revision.update((value) => value + 1);
          this.validationNotice.set('');
          this.phase.set('ready');
          this.focusStep();
        },
        error: (error: unknown) => {
          this.phase.set('error');
          this.pageError.set(
            error instanceof HttpErrorResponse && [403, 404].includes(error.status)
              ? 'This application is unavailable or you do not have permission to edit it.'
              : 'The draft could not load. Check your connection and try again.',
          );
        },
      });
  }

  protected goToStep(index: number): void {
    if (this.autosave.isSubmitting() || index < 0 || index > 4) return;
    if (index > this.step()) {
      const groups = [
        this.form.controls.business,
        this.form.controls.contact,
        this.form.controls.banking,
        this.form.controls.processing,
      ];
      for (let i = 0; i < index; i++) {
        if (groups[i].invalid) {
          groups[i].markAllAsTouched();
          this.step.set(i);
          this.validationNotice.set(
            'Check the highlighted fields before continuing. Your draft can still save while incomplete.',
          );
          this.focusStep();
          return;
        }
      }
    }
    this.validationNotice.set('');
    this.step.set(index);
    this.focusStep();
  }

  protected async save(): Promise<void> {
    this.focusStep();
    await this.autosave.saveNow();
  }

  protected async submit(): Promise<void> {
    if (this.autosave.isSubmitting() || this.autosave.submitted()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      const groups = [
        this.form.controls.business,
        this.form.controls.contact,
        this.form.controls.banking,
        this.form.controls.processing,
      ];
      const index = groups.findIndex((group) => group.invalid);
      this.step.set(index < 0 ? 0 : index);
      this.validationNotice.set('Check the highlighted fields before submitting.');
      this.focusStep();
      return;
    }
    this.autosave.queue(draftSnapshot(this.form), draftCanSave(this.form));
    this.form.disable({ emitEvent: false });
    const success = await this.autosave.submit();
    if (this.destroyRef.destroyed) return;
    if (success) {
      this.form.controls.banking.reset(
        { bankName: '', accountNumber: '', taxId: '' },
        { emitEvent: false },
      );
      this.revision.update((value) => value + 1);
      afterNextRender(() => this.pageHeading()?.nativeElement.focus(), { injector: this.injector });
    } else {
      this.form.enable({ emitEvent: false });
      const sections = ['business', 'contact', 'banking', 'processing'];
      const firstError = Object.keys(this.autosave.fieldErrors())[0]?.split('.')[0];
      if (firstError && sections.includes(firstError)) this.step.set(sections.indexOf(firstError));
      this.focusStep();
    }
  }

  protected async reloadServer(): Promise<void> {
    if (this.autosave.state() === 'saving' || this.autosave.isSubmitting()) return;
    const choice = await firstValueFrom(
      this.dialog
        .open<DraftExitDialog, { reload: boolean; canSave: boolean }, DraftExitChoice>(
          DraftExitDialog,
          {
            data: { reload: true, canSave: false },
            width: '520px',
            maxWidth: 'calc(100vw - 32px)',
          },
        )
        .afterClosed(),
    );
    if (choice === 'discard' && !this.destroyRef.destroyed) {
      this.step.set(0);
      this.load();
    }
  }

  canLeave(): Promise<boolean> {
    if (this.creating()) return Promise.resolve(false);
    if (!this.auth.isAuthenticated() || !this.autosave.hasPending()) return Promise.resolve(true);
    if (this.autosave.isSubmitting()) return Promise.resolve(false);
    if (this.exitRequest) return this.exitRequest;
    this.exitRequest = firstValueFrom(
      this.dialog
        .open<DraftExitDialog, { reload: boolean; canSave: boolean }, DraftExitChoice>(
          DraftExitDialog,
          {
            data: {
              reload: false,
              canSave: this.saveable() && this.autosave.state() !== 'conflict',
            },
            width: '520px',
            maxWidth: 'calc(100vw - 32px)',
          },
        )
        .afterClosed(),
    )
      .then(async (choice) => {
        if (choice === 'discard') return true;
        return choice === 'save' && (await this.autosave.saveNow());
      })
      .finally(() => {
        this.exitRequest = null;
      });
    return this.exitRequest;
  }

  @HostListener('window:beforeunload', ['$event'])
  protected beforeUnload(event: BeforeUnloadEvent): void {
    if (this.creating() || this.autosave.hasPending()) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  private focusStep(): void {
    afterNextRender(() => this.stepHeading()?.nativeElement.focus(), { injector: this.injector });
  }
}
