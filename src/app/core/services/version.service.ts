import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateSnapshotPayload, DiffResponse, Snapshot } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class VersionService {
  private readonly baseUrl = environment.versionServiceBaseUrl;

  constructor(private http: HttpClient) {}

  createSnapshot(payload: CreateSnapshotPayload): Observable<Snapshot> {
    return this.http.post<Snapshot>(this.baseUrl, payload);
  }

  getFileHistory(fileId: number): Observable<Snapshot[]> {
    return this.http.get<Snapshot[]>(`${this.baseUrl}/history/${fileId}`);
  }

  diffSnapshots(snapshotIdOne: string, snapshotIdTwo: string): Observable<DiffResponse> {
    return this.http.get<DiffResponse>(`${this.baseUrl}/diff`, {
      params: { snapshotIdOne, snapshotIdTwo }
    });
  }

  restoreSnapshot(snapshotId: string, authorId: number, message: string): Observable<Snapshot> {
    return this.http.post<Snapshot>(`${this.baseUrl}/${snapshotId}/restore`, {
      authorId,
      message
    });
  }

  createBranch(snapshotId: string, branchName: string): Observable<Snapshot> {
    return this.http.post<Snapshot>(`${this.baseUrl}/branch`, {
      snapshotId,
      branchName
    });
  }

  tagSnapshot(snapshotId: string, tag: string): Observable<Snapshot> {
    return this.http.post<Snapshot>(`${this.baseUrl}/tag`, {
      snapshotId,
      tag
    });
  }
}
