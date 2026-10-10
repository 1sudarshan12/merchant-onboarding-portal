import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ApplicationDetail,
  AssignmentRequest,
  DecisionRequest,
  SensitiveBanking,
  User,
  VersionRequest,
} from '../../../../shared/models';

@Injectable({ providedIn: 'root' })
export class ApplicationDetailApi {
  private readonly http = inject(HttpClient);

  get(id: string) {
    return this.http.get<ApplicationDetail>(`/api/applications/${encodeURIComponent(id)}`);
  }

  reviewers() {
    return this.http.get<User[]>('/api/reviewers');
  }

  assign(id: string, request: AssignmentRequest) {
    return this.http.put<ApplicationDetail>(
      `/api/applications/${encodeURIComponent(id)}/assignment`,
      request,
    );
  }

  decide(id: string, request: DecisionRequest) {
    return this.http.post<ApplicationDetail>(
      `/api/applications/${encodeURIComponent(id)}/decision`,
      request,
    );
  }

  reveal(id: string) {
    return this.http.get<SensitiveBanking>(`/api/applications/${encodeURIComponent(id)}/sensitive`);
  }
}
