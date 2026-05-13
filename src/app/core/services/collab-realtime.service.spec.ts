import { TestBed } from '@angular/core/testing';
import { CollabRealtimeMessage } from '../models/codesync.model';
import { CollabRealtimeService } from './collab-realtime.service';

class MockWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readonly sentMessages: string[] = [];

  constructor(readonly url: string) {
    sockets.push(this);
  }

  send = vi.fn((message: string) => {
    this.sentMessages.push(message);
  });

  close = vi.fn(() => {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new Event('close'));
  });

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  receive(data: string): void {
    this.onmessage?.({ data } as MessageEvent);
  }

  fail(): void {
    this.onerror?.(new Event('error'));
  }
}

let sockets: MockWebSocket[] = [];

describe('CollabRealtimeService', () => {
  let service: CollabRealtimeService;

  beforeEach(() => {
    sockets = [];
    vi.stubGlobal('crypto', { randomUUID: () => 'client-1' });
    vi.stubGlobal('WebSocket', MockWebSocket as unknown as typeof WebSocket);
    TestBed.configureTestingModule({});
    service = TestBed.inject(CollabRealtimeService);
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.unstubAllGlobals();
  });

  it('connect should create a socket URL with session, user, and client query params', () => {
    service.connect('session-1', 7);

    expect(sockets).toHaveLength(1);
    const url = new URL(sockets[0].url);
    expect(url.searchParams.get('sessionId')).toBe('session-1');
    expect(url.searchParams.get('userId')).toBe('7');
    expect(url.searchParams.get('clientId')).toBe('client-1');

    sockets[0].open();
    expect(service.connected$.value).toBe(true);
  });

  it('connect should reuse the active open socket for the same session', () => {
    service.connect('session-1', 7);
    sockets[0].open();

    service.connect('session-1', 7);

    expect(sockets).toHaveLength(1);
  });

  it('send should write JSON messages only when the socket is open', () => {
    const message: CollabRealtimeMessage = {
      type: 'CONTENT_CHANGE',
      sessionId: 'session-1',
      userId: 7,
      fileId: 10,
      content: 'updated'
    };

    service.send(message);
    expect(sockets).toHaveLength(0);

    service.connect('session-1', 7);
    service.send(message);
    expect(sockets[0].sentMessages).toEqual([]);

    sockets[0].open();
    service.send(message);

    expect(JSON.parse(sockets[0].sentMessages[0])).toEqual({
      ...message,
      clientId: 'client-1'
    });
  });

  it('should emit valid JSON socket messages and ignore malformed frames', () => {
    const received: CollabRealtimeMessage[] = [];
    service.messages$.subscribe((message) => received.push(message));
    service.connect('session-1', 7);

    const message: CollabRealtimeMessage = {
      type: 'CURSOR_UPDATE',
      sessionId: 'session-1',
      userId: 7,
      cursorLine: 12,
      cursorCol: 4
    };

    sockets[0].receive(JSON.stringify(message));
    sockets[0].receive('not json');

    expect(received).toEqual([message]);
  });

  it('disconnect should close the socket and update connection state', () => {
    service.connect('session-1', 7);
    sockets[0].open();

    service.disconnect();

    expect(sockets[0].close).toHaveBeenCalled();
    expect(service.connected$.value).toBe(false);
  });

  it('socket error should set connected state to false', () => {
    service.connect('session-1', 7);
    sockets[0].open();

    sockets[0].fail();

    expect(service.connected$.value).toBe(false);
  });
});
