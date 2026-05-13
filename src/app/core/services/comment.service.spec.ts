import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AddCommentPayload, CommentItem } from '../models/codesync.model';
import { CommentService } from './comment.service';

describe('CommentService', () => {
  let service: CommentService;
  let http: HttpTestingController;

  const comment: CommentItem = {
    commentId: 1,
    projectId: 2,
    fileId: 3,
    authorId: 4,
    content: 'Please update this line',
    lineNumber: 12,
    columnNumber: 4,
    parentCommentId: null,
    resolved: false,
    snapshotId: 'snapshot-1',
    createdAt: '2026-05-01T10:00:00',
    updatedAt: '2026-05-01T10:00:00'
  };

  const payload: AddCommentPayload = {
    projectId: 2,
    fileId: 3,
    authorId: 4,
    content: 'Please update this line',
    lineNumber: 12,
    columnNumber: 4,
    parentCommentId: null,
    snapshotId: 'snapshot-1'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(CommentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getCommentsByFile should GET comments for a file', () => {
    service.getCommentsByFile(3).subscribe((response) => expect(response).toEqual([comment]));

    const req = http.expectOne(`${environment.commentServiceBaseUrl}/file/3`);
    expect(req.request.method).toBe('GET');
    req.flush([comment]);
  });

  it('addComment should POST the payload', () => {
    service.addComment(payload).subscribe((response) => expect(response).toEqual(comment));

    const req = http.expectOne(environment.commentServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(comment);
  });

  it('replyToComment should include parentCommentId in the request body', () => {
    service.replyToComment(1, payload).subscribe();

    const req = http.expectOne(`${environment.commentServiceBaseUrl}/1/replies`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ...payload, parentCommentId: 1 });
    req.flush({ ...comment, parentCommentId: 1 });
  });

  it('should call resolve and unresolve endpoints', () => {
    service.resolveComment(1).subscribe();
    let req = http.expectOne(`${environment.commentServiceBaseUrl}/1/resolve`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush({ ...comment, resolved: true });

    service.unresolveComment(1).subscribe();
    req = http.expectOne(`${environment.commentServiceBaseUrl}/1/unresolve`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush(comment);
  });
});
