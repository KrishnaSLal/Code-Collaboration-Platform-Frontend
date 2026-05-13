import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, catchError, distinctUntilChanged, fromEvent, map, merge, of, shareReplay, switchMap, timer } from 'rxjs';

export const DEFAULT_LIVE_REFRESH_INTERVAL_MS = 5000;

export type LiveRefreshResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: unknown };

@Injectable({ providedIn: 'root' })
export class LiveRefreshService {
  private readonly document = inject(DOCUMENT);

  private readonly visible$ = merge(of(null), fromEvent(this.document, 'visibilitychange')).pipe(
    map(() => this.document.visibilityState !== 'hidden'),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  poll<T>(
    requestFactory: () => Observable<T>,
    intervalMs = DEFAULT_LIVE_REFRESH_INTERVAL_MS
  ): Observable<LiveRefreshResult<T>> {
    return this.visible$.pipe(
      switchMap((visible) => (visible ? timer(0, intervalMs) : EMPTY)),
      switchMap(() =>
        requestFactory().pipe(
          map((data) => ({ ok: true, data }) as const),
          catchError((error) => of({ ok: false, error } as const))
        )
      )
    );
  }
}
