import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FilePayload, FolderPayload, ProjectFile } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly baseUrl = environment.fileServiceBaseUrl;

  constructor(private http: HttpClient) {}

  createFile(payload: FilePayload): Observable<ProjectFile> {
    return this.http.post<ProjectFile>(this.baseUrl, payload);
  }

  createFolder(payload: FolderPayload): Observable<ProjectFile> {
    return this.http.post<ProjectFile>(`${this.baseUrl}/folders`, payload);
  }

  getProjectFiles(projectId: number): Observable<ProjectFile[]> {
    return this.http.get<ProjectFile[]>(`${this.baseUrl}/project/${projectId}/tree`);
  }

  searchInProject(projectId: number, keyword: string): Observable<ProjectFile[]> {
    return this.http.get<ProjectFile[]>(`${this.baseUrl}/project/${projectId}/search`, {
      params: { keyword }
    });
  }

  getFileContent(fileId: number): Observable<string> {
    return this.http.get(`${this.baseUrl}/${fileId}/content`, { responseType: 'text' });
  }

  updateFileContent(fileId: number, content: string, lastEditedBy: number): Observable<ProjectFile> {
    return this.http.put<ProjectFile>(`${this.baseUrl}/${fileId}/content`, {
      content,
      lastEditedBy
    });
  }

  renameFile(fileId: number, newName: string): Observable<ProjectFile> {
    return this.http.put<ProjectFile>(`${this.baseUrl}/${fileId}/rename`, { newName });
  }

  moveFile(fileId: number, newPath: string): Observable<ProjectFile> {
    return this.http.put<ProjectFile>(`${this.baseUrl}/${fileId}/move`, { newPath });
  }

  deleteFile(fileId: number): Observable<string> {
    return this.http.delete(`${this.baseUrl}/${fileId}`, { responseType: 'text' });
  }
}
