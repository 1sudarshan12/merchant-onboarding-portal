import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ApplicationDetail, MerchantFormPatch } from '../../../../shared/models';

@Injectable({ providedIn: 'root' })
export class DraftApi {
  private readonly http = inject(HttpClient);

  create() {
    return this.http.post<ApplicationDetail>('/api/applications', {});
  }

  get(id: string) {
    return this.http.get<ApplicationDetail>(this.path(id));
  }

  save(id: string, version: number, form: MerchantFormPatch) {
    return this.http.patch<ApplicationDetail>(this.path(id), { version, form });
  }

  submit(id: string, version: number) {
    return this.http.post<ApplicationDetail>(`${this.path(id)}/submit`, { version });
  }

  private path(id: string): string {
    return `/api/applications/${encodeURIComponent(id)}`;
  }
}
