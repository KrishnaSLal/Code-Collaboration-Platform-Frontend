import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Project, ProjectPayload } from '../models/codesync.model';
import { ProjectService } from './project.service';

describe('ProjectService', () => {
  let service: ProjectService;
  let http: HttpTestingController;

  const project: Project = {
    projectId: 1,
    ownerId: 7,
    projectName: 'CodeSync',
    description: 'Collaboration platform',
    language: 'Java',
    visibility: 'PUBLIC',
    archived: false,
    starCount: 2,
    forkCount: 1,
    createdAt: '2026-05-01T10:00:00',
    updatedAt: '2026-05-01T10:00:00'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(ProjectService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('createProject should POST the payload', () => {
    const payload: ProjectPayload = {
      ownerId: 7,
      projectName: 'CodeSync',
      description: 'Collaboration platform',
      language: 'Java',
      visibility: 'PUBLIC'
    };

    service.createProject(payload).subscribe((response) => expect(response).toEqual(project));

    const req = http.expectOne(environment.projectServiceBaseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(project);
  });

  it('should call project lookup endpoints', () => {
    service.getProjectById(1).subscribe();
    let req = http.expectOne(`${environment.projectServiceBaseUrl}/1`);
    expect(req.request.method).toBe('GET');
    req.flush(project);

    service.getProjectsByOwner(7).subscribe();
    req = http.expectOne(`${environment.projectServiceBaseUrl}/owner/7`);
    expect(req.request.method).toBe('GET');
    req.flush([project]);

    service.getPublicProjects().subscribe();
    req = http.expectOne(`${environment.projectServiceBaseUrl}/public`);
    expect(req.request.method).toBe('GET');
    req.flush([project]);
  });

  it('searchProjects should pass the keyword query parameter', () => {
    service.searchProjects('sync').subscribe();

    const req = http.expectOne((request) =>
      request.url === `${environment.projectServiceBaseUrl}/search` &&
      request.params.get('keyword') === 'sync'
    );
    expect(req.request.method).toBe('GET');
    req.flush([project]);
  });

  it('should call language, star, fork, and delete endpoints', () => {
    service.getProjectsByLanguage('Java').subscribe();
    let req = http.expectOne(`${environment.projectServiceBaseUrl}/language/Java`);
    expect(req.request.method).toBe('GET');
    req.flush([project]);

    service.starProject(1).subscribe();
    req = http.expectOne(`${environment.projectServiceBaseUrl}/1/star`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({});
    req.flush(project);

    service.forkProject(1, 9).subscribe();
    req = http.expectOne(`${environment.projectServiceBaseUrl}/1/fork/9`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(project);

    service.deleteProject(1).subscribe((response) => expect(response).toBe('deleted'));
    req = http.expectOne(`${environment.projectServiceBaseUrl}/1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.responseType).toBe('text');
    req.flush('deleted');
  });
});
