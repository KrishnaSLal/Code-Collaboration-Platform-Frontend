import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationItem, UnreadCount } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly baseUrl = environment.notificationServiceBaseUrl;

  constructor(private http: HttpClient) {}

  getByRecipient(recipientId: number): Observable<NotificationItem[]> {
    return this.http.get<NotificationItem[]>(`${this.baseUrl}/recipient/${recipientId}`);
  }

  getUnreadCount(recipientId: number): Observable<UnreadCount> {
    return this.http.get<UnreadCount>(`${this.baseUrl}/recipient/${recipientId}/unread-count`);
  }

  markAsRead(notificationId: number): Observable<NotificationItem> {
    return this.http.put<NotificationItem>(`${this.baseUrl}/${notificationId}/read`, {});
  }

  sendSessionInvite(payload: {
    recipientId: number;
    actorId: number;
    title: string;
    message: string;
    relatedId: string;
  }): Observable<NotificationItem> {
    return this.http.post<NotificationItem>(this.baseUrl, {
      ...payload,
      type: 'SESSION_INVITE',
      relatedType: 'SESSION'
    });
  }
}
