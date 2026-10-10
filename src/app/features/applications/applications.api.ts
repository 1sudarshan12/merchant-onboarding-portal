import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ApplicationSummary, ListQuery, Page } from '../../../../shared/models';

@Injectable({ providedIn: 'root' })
export class ApplicationsApi {
  private readonly http = inject(HttpClient);

  list(query: ListQuery): Observable<Page<ApplicationSummary>> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    if (query.search) params = params.set('search', query.search);
    if (query.status) params = params.set('status', query.status);
    return this.http.get<Page<ApplicationSummary>>('/api/applications', { params });
  }
}
