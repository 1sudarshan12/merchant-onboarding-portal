import { Injectable } from '@angular/core';

/** Lets explicit sign-out consult the same draft safeguard as router navigation. */
@Injectable({ providedIn: 'root' })
export class PendingChanges {
  private confirm: (() => Promise<boolean>) | null = null;

  register(confirm: () => Promise<boolean>): () => void {
    this.confirm = confirm;
    return () => {
      if (this.confirm === confirm) this.confirm = null;
    };
  }

  confirmLeaving(): Promise<boolean> {
    return this.confirm?.() ?? Promise.resolve(true);
  }
}
