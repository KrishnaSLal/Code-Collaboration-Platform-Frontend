import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { NotificationItem, UnreadCount } from '../models/codesync.model';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;

  const notification: NotificationItem = {
    notificationId: 1,
    recipientId: 7,
    actorId: 3,
    type: 'SESSION_INVITE',
    title: 'Join session',
    message: 'Pair with me',
    relatedId: 'session-1',
    relatedType: 'SESSION',
    isRead: false,
    createdAt: '2026-05-01T10:00:00'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(NotificationService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getByRecipient should GET notifications for a recipient', () => {
    service.getByRecipient(7).subscribe((response) => expect(response).toEqual([notification]));

    const req = http.expectOne(`${environment.notificationServiceBaseUrl}/recipient/7`);
    expect(req.request.method).toBe('GET');
    req.flush([notification]);
  });

  it('getUnreadCount should GET unread count for a recipient', () => {
    const unreadCount: UnreadCount = { recipientId: 7, unreadCount: 2 };

    service.getUnreadCount(7).subscribe((response) => expect(response).toEqual(unreadCount));

    const req = http.expectOne(`${environment.notificationServiceBaseUrl}/recipient/7/unread-count`);
    expect(req.request.method).toBe('GET');
    req.flush(unreadCount);
  });

  it('markAsRead should PUT to read endpoint', () => {
    service.markAsRead(1).subscribe((response) => expect(response.isRead).toBe(true));

    const req = http.expectOne(`${environment.notificationServiceBaseUrl}/1/read`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({ ...notification, isRead: true });
  });

  it('sendSessionInvite should enrich payload with notification type metadata', () => {
    const payload = {
      recipientId: 7,
      actorId: 3,
      title: 'Join session',
      message: 'Pair with me',
      relatedId: 'session-1'
    };

    service.sendSessionInvite(payload).subscribe((response) => expect(response).toEqual(notification));

    const req = http.expectOne(environment.notificationServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      ...payload,
      type: 'SESSION_INVITE',
      relatedType: 'SESSION'
    });
    req.flush(notification);
  });
});
