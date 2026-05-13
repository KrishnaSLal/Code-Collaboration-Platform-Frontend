import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CollabSession, Participant } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class CollabService {
  private readonly baseUrl = environment.collabServiceBaseUrl;

  constructor(private http: HttpClient) {}

  createSession(payload: {
    projectId: number;
    fileId: number;
    ownerId: number;
    language: string;
    maxParticipants: number | null;
    passwordProtected: boolean;
    sessionPassword: string | null;
  }): Observable<CollabSession> {
    return this.http.post<CollabSession>(this.baseUrl, payload);
  }

  getSessionsByProject(projectId: number): Observable<CollabSession[]> {
    return this.http.get<CollabSession[]>(`${this.baseUrl}/project/${projectId}`);
  }

  getSessionById(sessionId: string): Observable<CollabSession> {
    return this.http.get<CollabSession>(`${this.baseUrl}/${sessionId}`);
  }

  joinSession(sessionId: string, userId: number, role: string, sessionPassword: string): Observable<Participant> {
    return this.http.post<Participant>(`${this.baseUrl}/${sessionId}/join`, {
      userId,
      role,
      sessionPassword
    });
  }

  getParticipants(sessionId: string): Observable<Participant[]> {
    return this.http.get<Participant[]>(`${this.baseUrl}/${sessionId}/participants`);
  }

  updateCursor(sessionId: string, userId: number, cursorLine: number, cursorCol: number): Observable<Participant> {
    return this.http.put<Participant>(`${this.baseUrl}/${sessionId}/cursor`, {
      userId,
      cursorLine,
      cursorCol
    });
  }

  kickParticipant(sessionId: string, ownerId: number, participantUserId: number): Observable<Participant> {
    return this.http.post<Participant>(`${this.baseUrl}/${sessionId}/kick`, {
      ownerId,
      participantUserId
    });
  }

  sendSessionInvite(
    sessionId: string,
    payload: {
      recipientId: number;
      actorId: number;
      title: string;
      message: string;
    }
  ): Observable<string> {
    return this.http.post(`${this.baseUrl}/${sessionId}/invite`, payload, { responseType: 'text' });
  }

  endSession(sessionId: string): Observable<string> {
    return this.http.post(`${this.baseUrl}/${sessionId}/end`, {}, { responseType: 'text' });
  }
}
