import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { Project } from '../../core/models/codesync.model';
import { AuthService } from '../../core/services/auth.service';
import { ExecutionService } from '../../core/services/execution.service';
import { LiveRefreshService } from '../../core/services/live-refresh.service';
import { ProjectService } from '../../core/services/project.service';
import { HomeComponent } from './home.component';

describe('HomeComponent', () => {
  const languages = [
    { language: 'Java', version: '21' },
    { language: 'TypeScript', version: '5.9' }
  ];

  function project(overrides: Partial<Project>): Project {
    return {
      projectId: 1,
      ownerId: 7,
      projectName: 'CodeSync API',
      description: 'Shared editor backend',
      language: 'Java',
      visibility: 'PUBLIC',
      archived: false,
      starCount: 0,
      forkCount: 0,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides
    };
  }

  function createComponent(guestMode: boolean, pollResult: unknown) {
    const liveRefreshService = {
      poll: vi.fn(() => of(pollResult))
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { guestMode } } } },
        { provide: ProjectService, useValue: { getPublicProjects: vi.fn() } },
        { provide: ExecutionService, useValue: { getSupportedLanguages: vi.fn() } },
        { provide: LiveRefreshService, useValue: liveRefreshService }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new HomeComponent());
    return { component, liveRefreshService };
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should load guest projects and languages, then filter by search and language', () => {
    const older = project({
      projectId: 1,
      projectName: 'Java API',
      language: 'Java',
      updatedAt: '2026-01-01T00:00:00Z'
    });
    const newer = project({
      projectId: 2,
      projectName: 'Frontend Studio',
      description: 'Angular collaborative IDE',
      language: 'TypeScript',
      ownerFullName: 'Maya Dev',
      contributors: [{ userId: 8, fullName: 'UI Partner' }],
      updatedAt: '2026-02-01T00:00:00Z'
    });
    const { component } = createComponent(true, {
      ok: true,
      data: { projects: [older, newer], languages }
    });

    component.ngOnInit();

    expect(component.guestMode).toBe(true);
    expect(component.loading).toBe(false);
    expect(component.projects.map((item) => item.projectId)).toEqual([2, 1]);
    expect(component.filteredProjects.length).toBe(2);

    component.searchTerm = 'partner';
    component.selectedLanguage = 'TypeScript';
    component.applyFilters();

    expect(component.filteredProjects).toEqual([newer]);
  });

  it('should load only languages for authenticated home mode', () => {
    const { component, liveRefreshService } = createComponent(false, {
      ok: true,
      data: languages
    });

    component.ngOnInit();

    expect(liveRefreshService.poll).toHaveBeenCalledTimes(1);
    expect(component.guestMode).toBe(false);
    expect(component.languages).toEqual(languages);
    expect(component.loading).toBe(false);
    expect(component.projects).toEqual([]);
  });

  it('should show the guest load error only while initially loading', () => {
    const { component } = createComponent(true, { ok: false, error: new Error('offline') });

    component.ngOnInit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Unable to load public projects right now.');
    expect(component.languages).toEqual([]);
  });

  it('should build owner and contributor labels from the best available names', () => {
    const { component } = createComponent(true, { ok: true, data: { projects: [], languages: [] } });
    const item = project({
      ownerId: 42,
      owner: { userId: 42, username: 'owner-handle', fullName: 'Owner Name' },
      contributors: [
        { userId: 8, username: 'dev-a' },
        { userId: 9, fullName: 'Dev B' },
        { userId: 10, email: 'dev-c@example.com' },
        { userId: 11 }
      ]
    });

    expect(component.getOwnerLabel(item)).toBe('owner-handle');
    expect(component.getContributorLabels(item)).toEqual(['dev-a', 'Dev B', 'dev-c@example.com', 'User #11']);
    expect(component.getContributorLabels(project({ contributorUsernames: ['sam', 'sam', 'alex'] }))).toEqual(['sam', 'alex']);
  });
});
