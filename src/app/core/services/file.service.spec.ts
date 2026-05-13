import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { FilePayload, FolderPayload, ProjectFile } from '../models/codesync.model';
import { FileService } from './file.service';

describe('FileService', () => {
  let service: FileService;
  let http: HttpTestingController;

  const file: ProjectFile = {
    fileId: 10,
    projectId: 1,
    name: 'main.ts',
    path: 'src/main.ts',
    language: 'TypeScript',
    content: 'console.log("hi");',
    size: 18,
    folder: false,
    createdById: 7,
    lastEditedBy: 7,
    deleted: false,
    createdAt: '2026-05-01T10:00:00',
    updatedAt: '2026-05-01T10:00:00'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(FileService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createFile should POST the file payload', () => {
    const payload: FilePayload = {
      projectId: 1,
      name: 'main.ts',
      path: 'src/main.ts',
      language: 'TypeScript',
      content: 'console.log("hi");',
      createdById: 7
    };

    service.createFile(payload).subscribe((response) => expect(response).toEqual(file));

    const req = http.expectOne(environment.fileServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(file);
  });

  it('createFolder should POST to the folders endpoint', () => {
    const payload: FolderPayload = {
      projectId: 1,
      name: 'src',
      path: 'src',
      createdById: 7
    };

    service.createFolder(payload).subscribe();

    const req = http.expectOne(`${environment.fileServiceBaseUrl}/folders`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...file, folder: true });
  });

  it('should call project tree and search endpoints', () => {
    service.getProjectFiles(1).subscribe();
    let req = http.expectOne(`${environment.fileServiceBaseUrl}/project/1/tree`);
    expect(req.request.method).toBe('GET');
    req.flush([file]);

    service.searchInProject(1, 'main').subscribe();
    req = http.expectOne((request) =>
      request.url === `${environment.fileServiceBaseUrl}/project/1/search` &&
      request.params.get('keyword') === 'main'
    );
    expect(req.request.method).toBe('GET');
    req.flush([file]);
  });

  it('getFileContent should request plain text content', () => {
    service.getFileContent(10).subscribe((response) => expect(response).toBe(file.content));

    const req = http.expectOne(`${environment.fileServiceBaseUrl}/10/content`);
    expect(req.request.method).toBe('GET');
    expect(req.request.responseType).toBe('text');
    req.flush(file.content);
  });

  it('should call update, rename, move, and delete endpoints', () => {
    service.updateFileContent(10, 'updated', 8).subscribe();
    let req = http.expectOne(`${environment.fileServiceBaseUrl}/10/content`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ content: 'updated', lastEditedBy: 8 });
    req.flush({ ...file, content: 'updated', lastEditedBy: 8 });

    service.renameFile(10, 'app.ts').subscribe();
    req = http.expectOne(`${environment.fileServiceBaseUrl}/10/rename`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newName: 'app.ts' });
    req.flush({ ...file, name: 'app.ts' });

    service.moveFile(10, 'app/app.ts').subscribe();
    req = http.expectOne(`${environment.fileServiceBaseUrl}/10/move`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ newPath: 'app/app.ts' });
    req.flush({ ...file, path: 'app/app.ts' });

    service.deleteFile(10).subscribe((response) => expect(response).toBe('deleted'));
    req = http.expectOne(`${environment.fileServiceBaseUrl}/10`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.responseType).toBe('text');
    req.flush('deleted');
  });
});
