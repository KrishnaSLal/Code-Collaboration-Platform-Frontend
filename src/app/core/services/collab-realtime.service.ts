import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CollabRealtimeMessage } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class CollabRealtimeService implements OnDestroy {
  private readonly zone = inject(NgZone);
  private socket: WebSocket | null = null;
  private activeSessionId: string | null = null;
  readonly clientId = crypto.randomUUID();

  readonly messages$ = new Subject<CollabRealtimeMessage>();
  readonly connected$ = new BehaviorSubject(false);

  connect(sessionId: string, userId: number): void {
    if (this.socket && this.activeSessionId === sessionId && this.socket.readyState <= WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.activeSessionId = sessionId;

    const url = new URL(environment.collabSocketUrl);
    url.searchParams.set('sessionId', sessionId);
    url.searchParams.set('userId', String(userId));
    url.searchParams.set('clientId', this.clientId);

    this.socket = new WebSocket(url.toString());

    this.socket.onopen = () => {
      this.zone.run(() => this.connected$.next(true));
    };

    this.socket.onmessage = (event) => {
      this.zone.run(() => {
        try {
          this.messages$.next(JSON.parse(event.data) as CollabRealtimeMessage);
        } catch {
          // Ignore malformed socket frames; the REST API remains the source of truth.
        }
      });
    };

    this.socket.onclose = () => {
      this.zone.run(() => this.connected$.next(false));
    };

    this.socket.onerror = () => {
      this.zone.run(() => this.connected$.next(false));
    };
  }

  send(message: CollabRealtimeMessage): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return;
    }

    this.socket.send(JSON.stringify({ ...message, clientId: this.clientId }));
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.activeSessionId = null;
    this.connected$.next(false);
  }

  ngOnDestroy(): void {
    this.disconnect();
    this.messages$.complete();
    this.connected$.complete();
  }
}
