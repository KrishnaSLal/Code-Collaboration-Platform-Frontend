import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CreateSnapshotPayload, DiffResponse, Snapshot } from '../models/codesync.model';
import { VersionService } from './version.service';

describe('VersionService', () => {
  let service: VersionService;
  let http: HttpTestingController;

  const snapshot: Snapshot = {
    snapshotId: 'snapshot-1',
    projectId: 1,
    fileId: 2,
    authorId: 3,
    message: 'Initial commit',
    content: 'content',
    hash: 'hash',
    parentSnapshotId: null,
    branch: 'main',
    tag: null,
    createdAt: '2026-05-01T10:00:00'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VersionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createSnapshot should POST the payload', () => {
    const payload: CreateSnapshotPayload = {
      projectId: 1,
      fileId: 2,
      authorId: 3,
      message: 'Initial commit',
      content: 'content',
      parentSnapshotId: null,
      branch: 'main'
    };

    service.createSnapshot(payload).subscribe((response) => expect(response).toEqual(snapshot));

    const req = http.expectOne(environment.versionServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(snapshot);
  });

  it('getFileHistory should GET snapshots for a file', () => {
    service.getFileHistory(2).subscribe((response) => expect(response).toEqual([snapshot]));

    const req = http.expectOne(`${environment.versionServiceBaseUrl}/history/2`);
    expect(req.request.method).toBe('GET');
    req.flush([snapshot]);
  });

  it('diffSnapshots should pass both snapshot ids as query parameters', () => {
    const diff: DiffResponse = {
      snapshotIdOne: 'snapshot-1',
      snapshotIdTwo: 'snapshot-2',
      diffResult: '- old\n+ new'
    };

    service.diffSnapshots('snapshot-1', 'snapshot-2').subscribe((response) => expect(response).toEqual(diff));

    const req = http.expectOne((request) =>
      request.url === `${environment.versionServiceBaseUrl}/diff` &&
      request.params.get('snapshotIdOne') === 'snapshot-1' &&
      request.params.get('snapshotIdTwo') === 'snapshot-2'
    );
    expect(req.request.method).toBe('GET');
    req.flush(diff);
  });

  it('should call restore, branch, and tag endpoints', () => {
    service.restoreSnapshot('snapshot-1', 3, 'Restore content').subscribe();
    let req = http.expectOne(`${environment.versionServiceBaseUrl}/snapshot-1/restore`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ authorId: 3, message: 'Restore content' });
    req.flush(snapshot);

    service.createBranch('snapshot-1', 'feature/login').subscribe();
    req = http.expectOne(`${environment.versionServiceBaseUrl}/branch`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ snapshotId: 'snapshot-1', branchName: 'feature/login' });
    req.flush({ ...snapshot, branch: 'feature/login' });

    service.tagSnapshot('snapshot-1', 'v1.0').subscribe();
    req = http.expectOne(`${environment.versionServiceBaseUrl}/tag`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ snapshotId: 'snapshot-1', tag: 'v1.0' });
    req.flush({ ...snapshot, tag: 'v1.0' });
  });
});
