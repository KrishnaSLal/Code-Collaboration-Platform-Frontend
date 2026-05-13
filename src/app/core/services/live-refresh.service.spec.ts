import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { LiveRefreshResult, LiveRefreshService } from './live-refresh.service';

class TestDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

describe('LiveRefreshService', () => {
  let service: LiveRefreshService;
  let document: TestDocument;

  beforeEach(() => {
    vi.useFakeTimers();
    document = new TestDocument();
    TestBed.configureTestingModule({
      providers: [{ provide: DOCUMENT, useValue: document }]
    });
    service = TestBed.inject(LiveRefreshService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('poll should call the request factory immediately and on each interval while visible', () => {
    const results: LiveRefreshResult<number>[] = [];
    let calls = 0;

    const subscription = service.poll(() => of(++calls), 1000).subscribe((result) => results.push(result));

    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(1000);

    expect(results).toEqual([
      { ok: true, data: 1 },
      { ok: true, data: 2 }
    ]);
    subscription.unsubscribe();
  });

  it('poll should emit an error result when the request fails', () => {
    const error = new Error('request failed');
    const results: LiveRefreshResult<number>[] = [];

    const subscription = service.poll(() => throwError(() => error), 1000).subscribe((result) => results.push(result));

    vi.advanceTimersByTime(0);

    expect(results).toEqual([{ ok: false, error }]);
    subscription.unsubscribe();
  });

  it('poll should pause while the document is hidden and resume when visible', () => {
    const results: LiveRefreshResult<number>[] = [];
    let calls = 0;
    document.visibilityState = 'hidden';

    const subscription = service.poll(() => of(++calls), 1000).subscribe((result) => results.push(result));

    vi.advanceTimersByTime(5000);
    expect(results).toEqual([]);

    document.visibilityState = 'visible';
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(0);

    expect(results).toEqual([{ ok: true, data: 1 }]);
    subscription.unsubscribe();
  });
});
