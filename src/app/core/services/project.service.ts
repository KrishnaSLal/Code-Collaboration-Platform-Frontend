import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Project, ProjectPayload } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly baseUrl = environment.projectServiceBaseUrl;

  constructor(private http: HttpClient) {}

  createProject(payload: ProjectPayload): Observable<Project> {
    return this.http.post<Project>(this.baseUrl, payload);
  }

  getProjectById(projectId: number): Observable<Project> {
    return this.http.get<Project>(`${this.baseUrl}/${projectId}`);
  }

  getProjectsByOwner(ownerId: number): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/owner/${ownerId}`);
  }

  getPublicProjects(): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/public`);
  }

  searchProjects(keyword: string): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/search`, {
      params: { keyword }
    });
  }

  getProjectsByLanguage(language: string): Observable<Project[]> {
    return this.http.get<Project[]>(`${this.baseUrl}/language/${language}`);
  }

  starProject(projectId: number): Observable<Project> {
    return this.http.put<Project>(`${this.baseUrl}/${projectId}/star`, {});
  }

  forkProject(projectId: number, newOwnerId: number): Observable<Project> {
    return this.http.post<Project>(`${this.baseUrl}/${projectId}/fork/${newOwnerId}`, {});
  }

  deleteProject(projectId: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/${projectId}`, { responseType: 'text' });
  }
}
