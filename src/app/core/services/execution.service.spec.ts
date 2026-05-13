import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  ExecutionRequestPayload,
  ExecutionResponse,
  ExecutionStats,
  LanguageInfo
} from '../models/codesync.model';
import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let http: HttpTestingController;

  const execution: ExecutionResponse = {
    jobId: 'job-1',
    projectId: 1,
    fileId: 2,
    userId: 3,
    language: 'Python',
    sourceCode: 'print("hi")',
    stdin: '',
    status: 'COMPLETED',
    stdout: 'hi\n',
    stderr: '',
    exitCode: 0,
    executionTimeMs: 50,
    memoryUsedKb: null,
    createdAt: '2026-05-01T10:00:00',
    completedAt: '2026-05-01T10:00:01'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ExecutionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('submitExecution should POST source code execution payload', () => {
    const payload: ExecutionRequestPayload = {
      projectId: 1,
      fileId: 2,
      userId: 3,
      language: 'Python',
      sourceCode: 'print("hi")',
      stdin: ''
    };

    service.submitExecution(payload).subscribe((response) => expect(response).toEqual(execution));

    const req = http.expectOne(environment.executionServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(execution);
  });

  it('should call execution listing and language endpoints', () => {
    service.getExecutionsByProject(1).subscribe();
    let req = http.expectOne(`${environment.executionServiceBaseUrl}/project/1`);
    expect(req.request.method).toBe('GET');
    req.flush([execution]);

    const languages: LanguageInfo[] = [{ language: 'Python', version: '3.x' }];
    service.getSupportedLanguages().subscribe((response) => expect(response).toEqual(languages));
    req = http.expectOne(`${environment.executionServiceBaseUrl}/supportedLanguages`);
    expect(req.request.method).toBe('GET');
    req.flush(languages);
  });

  it('should call stats endpoints', () => {
    const stats: ExecutionStats = {
      totalExecutions: 5,
      completedExecutions: 4,
      failedExecutions: 1,
      cancelledExecutions: 0
    };

    service.getExecutionStats().subscribe((response) => expect(response).toEqual(stats));
    let req = http.expectOne(`${environment.executionServiceBaseUrl}/stats`);
    expect(req.request.method).toBe('GET');
    req.flush(stats);

    service.getExecutionStatsByUser(3).subscribe();
    req = http.expectOne(`${environment.executionServiceBaseUrl}/stats/user/3`);
    expect(req.request.method).toBe('GET');
    req.flush(stats);
  });

  it('should call cancel and project deletion endpoints', () => {
    service.cancelExecution('job-1').subscribe();
    let req = http.expectOne(`${environment.executionServiceBaseUrl}/job-1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ...execution, status: 'CANCELLED' });

    service.deleteExecutionsByProject(1).subscribe((response) => expect(response).toBe('deleted'));
    req = http.expectOne(`${environment.executionServiceBaseUrl}/project/1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.responseType).toBe('text');
    req.flush('deleted');
  });
});
