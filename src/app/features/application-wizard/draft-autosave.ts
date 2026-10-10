import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, firstValueFrom, Subject, timeout } from 'rxjs';
import type { ApplicationDetail, MerchantFormPatch } from '../../../../shared/models';
import { DraftApi } from './draft.api';

export type SaveState = 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict';

/** Serial writes with a single latest pending snapshot; never cancel a save for a newer edit. */
@Injectable()
export class DraftAutosave {
  private readonly api = inject(DraftApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly changes = new Subject<void>();
  private readonly currentDetail = signal<ApplicationDetail | null>(null);
  private readonly saveState = signal<SaveState>('saved');
  private readonly errorMessage = signal('');
  private readonly errors = signal<Record<string, string>>({});
  private readonly submitting = signal(false);
  private readonly didSubmit = signal(false);
  private latest: MerchantFormPatch = {};
  private acknowledged: MerchantFormPatch = {};
  private canSave = true;
  private inFlight = false;
  private due = false;
  private destroyed = false;
  private unconfirmedWrite = false;
  private waiters: Array<(saved: boolean) => void> = [];

  readonly detail = this.currentDetail.asReadonly();
  readonly state = this.saveState.asReadonly();
  readonly message = this.errorMessage.asReadonly();
  readonly fieldErrors = this.errors.asReadonly();
  readonly isSubmitting = this.submitting.asReadonly();
  readonly submitted = this.didSubmit.asReadonly();
  readonly hasPending = computed(() => this.state() !== 'saved' || this.isSubmitting());

  constructor() {
    this.changes.pipe(debounceTime(700), takeUntilDestroyed()).subscribe(() => {
      this.due = true;
      this.drain();
    });
    this.destroyRef.onDestroy(() => {
      this.destroyed = true;
      this.settle(false);
    });
  }

  /** Call on initial load or after an explicit decision to discard local changes. */
  initialize(detail: ApplicationDetail, snapshot: MerchantFormPatch): void {
    if (this.inFlight || this.isSubmitting()) return;
    this.currentDetail.set(detail);
    this.latest = structuredClone(snapshot);
    this.acknowledged = structuredClone(snapshot);
    this.saveState.set('saved');
    this.errorMessage.set('');
    this.errors.set({});
    this.didSubmit.set(false);
    this.canSave = true;
    this.due = false;
    this.unconfirmedWrite = false;
  }

  queue(snapshot: MerchantFormPatch, canSave = true): void {
    if (this.destroyed || !this.detail() || this.isSubmitting() || this.submitted()) return;
    // Keep server feedback until that section changes. Cross-field corrections can
    // affect a sibling field, so section changes clear the section's stale errors.
    this.errors.update((errors) =>
      Object.fromEntries(
        Object.entries(errors).filter(([path]) => {
          const section = path.split('.')[0] as keyof MerchantFormPatch;
          return JSON.stringify(snapshot[section]) === JSON.stringify(this.latest[section]);
        }),
      ),
    );
    this.latest = structuredClone(snapshot);
    this.canSave = canSave;
    if (this.state() === 'conflict') return;
    this.errorMessage.set('');
    this.due = false;
    this.saveState.set(
      this.inFlight ? 'saving' : canSave && this.isAcknowledged() ? 'saved' : 'unsaved',
    );
    this.changes.next();
  }

  /** Flush debounce and resolve only after the latest snapshot has been acknowledged. */
  saveNow(): Promise<boolean> {
    if (this.destroyed || !this.detail() || this.state() === 'conflict' || !this.canSave) {
      return Promise.resolve(false);
    }
    if (!this.inFlight && this.isAcknowledged()) return Promise.resolve(true);
    if (this.state() === 'error') {
      this.saveState.set('unsaved');
      this.errorMessage.set('');
    }
    this.due = true;
    const result = new Promise<boolean>((resolve) => this.waiters.push(resolve));
    this.drain();
    return result;
  }

  async submit(): Promise<boolean> {
    if (this.destroyed || this.isSubmitting() || this.submitted() || this.state() === 'conflict') {
      return false;
    }
    this.submitting.set(true);
    this.errors.set({});
    this.errorMessage.set('');
    try {
      if (!(await this.saveNow()) || this.destroyed) return false;
      const current = this.detail();
      if (!current) return false;
      const result = await firstValueFrom(
        this.api
          .submit(current.id, current.version)
          .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef)),
      );
      if (this.destroyed) return false;
      this.currentDetail.set(result);
      this.didSubmit.set(true);
      this.saveState.set('saved');
      // Remove raw replacements from this coordinator once the workflow is finished.
      this.latest = {};
      this.acknowledged = {};
      return true;
    } catch (error: unknown) {
      if (this.destroyed) return false;
      if (error instanceof HttpErrorResponse && error.status === 409) {
        this.conflict();
      } else {
        this.errors.set(this.readFieldErrors(error));
        this.errorMessage.set(
          error instanceof HttpErrorResponse && error.status === 422
            ? 'Review the highlighted fields before submitting again.'
            : 'Submission could not be confirmed. Your draft is saved. Reload its status before retrying if your connection was interrupted.',
        );
      }
      return false;
    } finally {
      this.submitting.set(false);
    }
  }

  private drain(): void {
    if (this.destroyed || this.inFlight || !this.due || !this.detail()) return;
    if (this.state() === 'conflict' || this.state() === 'error') return;
    if (!this.canSave) {
      this.saveState.set('unsaved');
      this.settle(false);
      return;
    }
    if (this.isAcknowledged()) {
      this.saveState.set('saved');
      this.settle(true);
      return;
    }
    const current = this.detail()!;
    const snapshot = structuredClone(this.latest);
    this.inFlight = true;
    this.due = false;
    this.saveState.set('saving');
    this.api
      .save(current.id, current.version, snapshot)
      .pipe(timeout(15_000), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.inFlight = false;
          this.currentDetail.set(saved);
          this.acknowledged = snapshot;
          this.unconfirmedWrite = false;
          if (this.canSave && this.isAcknowledged()) {
            this.saveState.set('saved');
            this.settle(true);
          } else {
            this.saveState.set('unsaved');
            // Explicit flushes await all edits; ordinary typing keeps its debounce interval.
            if (this.waiters.length > 0) this.due = true;
            this.drain();
          }
        },
        error: (error: unknown) => {
          this.inFlight = false;
          // A lost response is not proof that the server rejected the write. Even an undo
          // needs reconciliation using our last acknowledged version before it is "saved".
          this.unconfirmedWrite = true;
          if (error instanceof HttpErrorResponse && error.status === 409) {
            this.conflict();
          } else {
            this.saveState.set('error');
            this.errorMessage.set(
              'Save could not be confirmed. Your edits are still here. Retry saving to continue.',
            );
            this.errors.set(this.readFieldErrors(error));
          }
          this.settle(false);
        },
      });
  }

  private conflict(): void {
    this.saveState.set('conflict');
    this.errorMessage.set(
      'This application changed on the server. Your edits are kept here and saving is paused. Review them before discarding them and loading the server copy.',
    );
  }

  private isAcknowledged(): boolean {
    return (
      !this.unconfirmedWrite && JSON.stringify(this.latest) === JSON.stringify(this.acknowledged)
    );
  }

  private settle(saved: boolean): void {
    const waiters = this.waiters;
    this.waiters = [];
    waiters.forEach((resolve) => resolve(saved));
  }

  private readFieldErrors(error: unknown): Record<string, string> {
    if (!(error instanceof HttpErrorResponse)) return {};
    const fields: unknown = error.error?.fields;
    if (typeof fields !== 'object' || fields === null || Array.isArray(fields)) return {};
    return Object.fromEntries(
      Object.entries(fields).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
  }
}
