import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CollabSession, Participant } from '../models/codesync.model';
import { CollabService } from './collab.service';

describe('CollabService', () => {
  let service: CollabService;
  let http: HttpTestingController;

  const session: CollabSession = {
    sessionId: 'session-1',
    projectId: 1,
    fileId: 2,
    ownerId: 3,
    status: 'ACTIVE',
    language: 'TypeScript',
    createdAt: '2026-05-01T10:00:00',
    endedAt: null,
    maxParticipants: 5,
    passwordProtected: false
  };

  const participant: Participant = {
    participantId: 9,
    sessionId: 'session-1',
    userId: 4,
    role: 'EDITOR',
    joinedAt: '2026-05-01T10:00:00',
    leftAt: null,
    cursorLine: 1,
    cursorCol: 1,
    color: '#FF5733'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CollabService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createSession should POST the collaboration session payload', () => {
    const payload = {
      projectId: 1,
      fileId: 2,
      ownerId: 3,
      language: 'TypeScript',
      maxParticipants: 5,
      passwordProtected: false,
      sessionPassword: null
    };

    service.createSession(payload).subscribe((response) => expect(response).toEqual(session));

    const req = http.expectOne(environment.collabServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(session);
  });

  it('should call session listing, join, and participants endpoints', () => {
    service.getSessionById('session-1').subscribe((response) => expect(response).toEqual(session));
    let req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1`);
    expect(req.request.method).toBe('GET');
    req.flush(session);

    service.getSessionsByProject(1).subscribe();
    req = http.expectOne(`${environment.collabServiceBaseUrl}/project/1`);
    expect(req.request.method).toBe('GET');
    req.flush([session]);

    service.joinSession('session-1', 4, 'EDITOR', 'secret').subscribe();
    req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1/join`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 4, role: 'EDITOR', sessionPassword: 'secret' });
    req.flush(participant);

    service.getParticipants('session-1').subscribe();
    req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1/participants`);
    expect(req.request.method).toBe('GET');
    req.flush([participant]);
  });

  it('should call cursor, kick, invite, and end endpoints', () => {
    service.updateCursor('session-1', 4, 20, 5).subscribe();
    let req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1/cursor`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ userId: 4, cursorLine: 20, cursorCol: 5 });
    req.flush({ ...participant, cursorLine: 20, cursorCol: 5 });

    service.kickParticipant('session-1', 3, 4).subscribe();
    req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1/kick`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ownerId: 3, participantUserId: 4 });
    req.flush({ ...participant, leftAt: '2026-05-01T10:05:00' });

    const invite = {
      recipientId: 5,
      actorId: 3,
      title: 'Join session',
      message: 'Pair with me'
    };
    service.sendSessionInvite('session-1', invite).subscribe((response) => expect(response).toBe('queued'));
    req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1/invite`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('text');
    expect(req.request.body).toEqual(invite);
    req.flush('queued');

    service.endSession('session-1').subscribe((response) => expect(response).toBe('ended'));
    req = http.expectOne(`${environment.collabServiceBaseUrl}/session-1/end`);
    expect(req.request.method).toBe('POST');
    expect(req.request.responseType).toBe('text');
    expect(req.request.body).toEqual({});
    req.flush('ended');
  });
});
