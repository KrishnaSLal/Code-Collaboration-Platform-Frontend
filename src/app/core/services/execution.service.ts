import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ExecutionRequestPayload,
  ExecutionResponse,
  ExecutionStats,
  LanguageInfo
} from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class ExecutionService {
  private readonly baseUrl = environment.executionServiceBaseUrl;

  constructor(private http: HttpClient) {}

  submitExecution(payload: ExecutionRequestPayload): Observable<ExecutionResponse> {
    return this.http.post<ExecutionResponse>(this.baseUrl, payload);
  }

  getExecutionsByProject(projectId: number): Observable<ExecutionResponse[]> {
    return this.http.get<ExecutionResponse[]>(`${this.baseUrl}/project/${projectId}`);
  }

  getSupportedLanguages(): Observable<LanguageInfo[]> {
    return this.http.get<LanguageInfo[]>(`${this.baseUrl}/supportedLanguages`);
  }

  getExecutionStats(): Observable<ExecutionStats> {
    return this.http.get<ExecutionStats>(`${this.baseUrl}/stats`);
  }

  getExecutionStatsByUser(userId: number): Observable<ExecutionStats> {
    return this.http.get<ExecutionStats>(`${this.baseUrl}/stats/user/${userId}`);
  }

  cancelExecution(jobId: string): Observable<ExecutionResponse> {
    return this.http.post<ExecutionResponse>(`${this.baseUrl}/${jobId}/cancel`, {});
  }

  deleteExecutionsByProject(projectId: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/project/${projectId}`, { responseType: 'text' });
  }
}
