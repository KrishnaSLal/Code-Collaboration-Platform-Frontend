import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, map, of, throwError } from 'rxjs';
import { CurrentUser } from '../../core/models/auth.model';
import {
  CollabRealtimeMessage,
  CollabSession,
  CommentItem,
  ExecutionResponse,
  Participant,
  Project,
  ProjectFile,
  Snapshot
} from '../../core/models/codesync.model';
import { AuthService } from '../../core/services/auth.service';
import { CollabRealtimeService } from '../../core/services/collab-realtime.service';
import { CollabService } from '../../core/services/collab.service';
import { CommentService } from '../../core/services/comment.service';
import { ExecutionService } from '../../core/services/execution.service';
import { FileService } from '../../core/services/file.service';
import { LiveRefreshService } from '../../core/services/live-refresh.service';
import { EXECUTION_PASS_PRICE_IN_PAISE, PaymentService } from '../../core/services/payment.service';
import { ProjectService } from '../../core/services/project.service';
import { VersionService } from '../../core/services/version.service';
import { WorkspaceComponent } from './workspace.component';

describe('WorkspaceComponent', () => {
  const currentUser: CurrentUser = {
    userId: 7,
    fullName: 'Krishna Lal',
    email: 'krishna@example.com',
    token: 'token'
  };

  function project(overrides: Partial<Project> = {}): Project {
    return {
      projectId: 1,
      ownerId: currentUser.userId,
      ownerUsername: 'owner',
      projectName: 'CodeSync',
      description: 'Collaborative IDE',
      language: 'Java',
      visibility: 'PUBLIC',
      archived: false,
      starCount: 0,
      forkCount: 0,
      contributors: [],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides
    };
  }

  function file(overrides: Partial<ProjectFile> = {}): ProjectFile {
    return {
      fileId: 10,
      projectId: 1,
      name: 'Main.java',
      path: 'src/Main.java',
      language: 'Java',
      content: 'public class Main {}',
      size: 20,
      folder: false,
      createdById: currentUser.userId,
      lastEditedBy: currentUser.userId,
      deleted: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides
    };
  }

  function execution(overrides: Partial<ExecutionResponse> = {}): ExecutionResponse {
    return {
      jobId: 'job-1',
      projectId: 1,
      fileId: 10,
      userId: currentUser.userId,
      language: 'Java',
      sourceCode: 'public class Main {}',
      stdin: '',
      status: 'COMPLETED',
      stdout: 'ok',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 100,
      memoryUsedKb: 256,
      createdAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:01Z',
      ...overrides
    };
  }

  function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
    return {
      snapshotId: 'snap-1',
      projectId: 1,
      fileId: 10,
      authorId: currentUser.userId,
      message: 'Initial',
      content: 'public class Main {}',
      hash: 'abc',
      parentSnapshotId: null,
      branch: 'main',
      tag: null,
      createdAt: '2026-01-01T00:00:00Z',
      ...overrides
    };
  }

  function comment(overrides: Partial<CommentItem> = {}): CommentItem {
    return {
      commentId: 1,
      projectId: 1,
      fileId: 10,
      authorId: currentUser.userId,
      content: 'Looks good',
      lineNumber: 1,
      columnNumber: null,
      parentCommentId: null,
      resolved: false,
      snapshotId: 'snap-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      ...overrides
    };
  }

  function session(overrides: Partial<CollabSession> = {}): CollabSession {
    return {
      sessionId: 'session-1',
      projectId: 1,
      fileId: 10,
      ownerId: currentUser.userId,
      status: 'ACTIVE',
      language: 'Java',
      createdAt: '2026-01-01T00:00:00Z',
      endedAt: null,
      maxParticipants: 5,
      passwordProtected: false,
      ...overrides
    };
  }

  function participant(overrides: Partial<Participant> = {}): Participant {
    return {
      participantId: 1,
      sessionId: 'session-1',
      userId: 8,
      username: 'dev-b',
      role: 'EDITOR',
      joinedAt: '2026-01-01T00:00:00Z',
      leftAt: null,
      cursorLine: 1,
      cursorCol: 1,
      color: '#22c55e',
      ...overrides
    };
  }

  function createComponent(user: CurrentUser | null = currentUser, queryParams: Record<string, string> = {}) {
    const connected$ = new BehaviorSubject(false);
    const messages$ = new Subject<CollabRealtimeMessage>();
    const authService = {
      currentUser: vi.fn(() => user),
      getUsersByIds: vi.fn((ids: number[]) =>
        of(ids.map((userId) => ({ userId, fullName: `User ${userId}`, email: `user${userId}@example.com` })))
      )
    };
    const projectService = {
      getProjectById: vi.fn(),
      deleteProject: vi.fn()
    };
    const fileService = {
      getProjectFiles: vi.fn(),
      searchInProject: vi.fn(),
      createFile: vi.fn(),
      createFolder: vi.fn(),
      updateFileContent: vi.fn(),
      deleteFile: vi.fn(),
      renameFile: vi.fn(),
      moveFile: vi.fn(),
      getFileContent: vi.fn()
    };
    const executionService = {
      getSupportedLanguages: vi.fn(() => of([{ language: 'Java', version: '21' }])),
      getExecutionsByProject: vi.fn(),
      submitExecution: vi.fn(),
      cancelExecution: vi.fn(),
      deleteExecutionsByProject: vi.fn()
    };
    const versionService = {
      getFileHistory: vi.fn(),
      createSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
      createBranch: vi.fn(),
      tagSnapshot: vi.fn(),
      diffSnapshots: vi.fn()
    };
    const commentService = {
      getCommentsByFile: vi.fn(),
      addComment: vi.fn(),
      replyToComment: vi.fn(),
      resolveComment: vi.fn(),
      unresolveComment: vi.fn()
    };
    const collabService = {
      getSessionsByProject: vi.fn(),
      createSession: vi.fn(),
      joinSession: vi.fn(),
      updateCursor: vi.fn(),
      endSession: vi.fn(),
      sendSessionInvite: vi.fn(),
      kickParticipant: vi.fn(),
      getParticipants: vi.fn()
    };
    const collabRealtimeService = {
      clientId: 'client-1',
      connected$: connected$.asObservable(),
      messages$: messages$.asObservable(),
      connect: vi.fn(),
      disconnect: vi.fn(),
      send: vi.fn()
    };
    const liveRefreshService = {
      poll: vi.fn(() => of({ ok: false }))
    };
    const paymentService = {
      hasExecutionPass: vi.fn(() => false),
      createOrder: vi.fn(),
      verifyPayment: vi.fn(),
      activateExecutionPass: vi.fn(),
      getPaymentErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
    };
    const router = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ projectId: '1' })),
            queryParamMap: of(convertToParamMap(queryParams))
          }
        },
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: authService },
        { provide: ProjectService, useValue: projectService },
        { provide: FileService, useValue: fileService },
        { provide: ExecutionService, useValue: executionService },
        { provide: VersionService, useValue: versionService },
        { provide: CommentService, useValue: commentService },
        { provide: CollabService, useValue: collabService },
        { provide: CollabRealtimeService, useValue: collabRealtimeService },
        { provide: LiveRefreshService, useValue: liveRefreshService },
        { provide: PaymentService, useValue: paymentService }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new WorkspaceComponent());

    return {
      component,
      connected$,
      messages$,
      authService,
      projectService,
      fileService,
      executionService,
      versionService,
      commentService,
      collabService,
      collabRealtimeService,
      liveRefreshService,
      paymentService,
      router
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
    delete (window as any).Razorpay;
  });

  it('should derive workspace and collaboration permissions from current state', () => {
    const { component } = createComponent();
    component.project = project();
    component.selectedFile = file();
    component.sessions = [session()];
    component.participants = [participant({ userId: currentUser.userId, participantId: 7 })];

    expect(component.isReadOnly).toBe(false);
    expect(component.isOwner).toBe(true);
    expect(component.activeSession?.sessionId).toBe('session-1');
    expect(component.isSessionHost).toBe(true);
    expect(component.hasJoinedActiveSession).toBe(true);
    expect(component.mustJoinActiveSession).toBe(false);
    expect(component.canModifyWorkspace).toBe(true);
    expect(component.isEditorReadOnly).toBe(false);
  });

  it('should build participant, invite, and snapshot labels from known names', () => {
    const { component } = createComponent();
    component.project = project({
      contributors: [{ userId: 8, username: 'dev-b' }],
      contributorIds: [9],
      contributorUsernames: ['dev-c']
    });
    component.participants = [participant({ userId: 10, fullName: 'Session Guest' })];
    component.participantProfiles = {
      11: { userId: 11, fullName: 'Profile User', email: 'profile@example.com' }
    };

    expect(component.inviteRecipientOptions).toEqual(['dev-b', 'dev-c', 'Profile User', 'profile@example.com', 'Session Guest']);
    expect(component.getParticipantDisplayName(participant({ userId: 10, username: undefined, fullName: 'Session Guest' }))).toBe('Session Guest');
    expect(component.getSnapshotAuthorName(snapshot({ authorId: 11 }))).toBe('Profile User');
  });

  it('should filter files locally or through project search', () => {
    const { component, fileService } = createComponent();
    const folder = file({ fileId: 1, name: 'src', path: 'src', folder: true, content: '' });
    const main = file({ fileId: 2, name: 'Main.java', path: 'src/Main.java', content: 'class Main {}' });
    const readme = file({ fileId: 3, name: 'README.md', path: 'README.md', language: null, content: 'docs' });
    component.project = project();
    component.files = [readme, main, folder];

    component.projectSearch = '';
    component.filterFiles();
    expect(component.filteredFiles.map((item) => item.fileId)).toEqual([1, 3, 2]);

    fileService.searchInProject.mockReturnValue(of([main]));
    component.projectSearch = 'main';
    component.filterFiles();
    expect(fileService.searchInProject).toHaveBeenCalledWith(1, 'main');
    expect(component.filteredFiles).toEqual([main]);

    fileService.searchInProject.mockReturnValue(throwError(() => new Error('offline')));
    component.projectSearch = 'docs';
    component.filterFiles();
    expect(component.filteredFiles).toEqual([readme]);
  });

  it('should create files and folders, save content, and delete the selected file', () => {
    const { component, fileService } = createComponent();
    const folder = file({ fileId: 1, name: 'src', path: 'src', folder: true, content: '' });
    const createdFile = file({ fileId: 2, name: 'App.java', path: 'src/App.java' });
    const createdFolder = file({ fileId: 3, name: 'utils', path: 'src/utils', folder: true, content: '' });
    const savedFile = file({ fileId: 2, name: 'App.java', path: 'src/App.java', content: 'updated' });
    component.project = project();
    component.selectedFile = folder;
    component.files = [folder];
    component.filteredFiles = [folder];
    component.newFileName = ' App.java ';
    component.newFolderName = ' utils ';
    fileService.createFile.mockReturnValue(of(createdFile));
    fileService.createFolder.mockReturnValue(of(createdFolder));
    fileService.updateFileContent.mockReturnValue(of(savedFile));
    fileService.deleteFile.mockReturnValue(of('deleted'));

    component.createFile();
    expect(fileService.createFile).toHaveBeenCalledWith({
      projectId: 1,
      name: 'App.java',
      path: 'src/App.java',
      language: 'Java',
      content: '',
      createdById: currentUser.userId
    });
    expect(component.selectedFile).toEqual(createdFile);

    component.selectedFile = folder;
    component.createFolder();
    expect(fileService.createFolder).toHaveBeenCalledWith({
      projectId: 1,
      name: 'utils',
      path: 'src/utils',
      createdById: currentUser.userId
    });

    component.selectedFile = createdFile;
    component.editorContent = 'updated';
    component.saveFile();
    expect(component.saveMessage).toBe('Changes saved to file service.');
    expect(component.selectedFile).toEqual(savedFile);

    component.filteredFiles = [savedFile];
    component.deleteSelectedFile();
    expect(fileService.deleteFile).toHaveBeenCalledWith(2);
    expect(component.selectedFile).toBeNull();
  });

  it('should normalize Java source when running code and start payment at the free limit', () => {
    const { component, executionService, paymentService } = createComponent();
    let razorpayOptions: any;
    (window as any).Razorpay = class {
      constructor(options: any) {
        razorpayOptions = options;
      }

      open = vi.fn();
    };
    component.project = project();
    component.selectedFile = file({ language: 'Java' });
    component.editorContent = 'public class Solution { public static void main(String[] args) {} }';
    component.stdin = 'input';
    executionService.submitExecution.mockReturnValue(of(execution({ jobId: 'job-run' })));

    component.runCode();

    expect(executionService.submitExecution).toHaveBeenCalledWith({
      projectId: 1,
      fileId: 10,
      userId: currentUser.userId,
      language: 'Java',
      sourceCode: 'public class Main { public static void main(String[] args) {} }',
      stdin: 'input'
    });
    expect(component.executions[0].jobId).toBe('job-run');

    component.selectedFileExecutionCount = component.freeExecutionLimit;
    paymentService.createOrder.mockReturnValue(
      of({
        keyId: 'rzp_test',
        orderId: 'order_1',
        amount: EXECUTION_PASS_PRICE_IN_PAISE,
        currency: 'INR',
        receipt: 'receipt_1'
      })
    );
    component.runCode();

    expect(component.executionLimitMessage).toContain('free code runs');
    expect(paymentService.createOrder).toHaveBeenCalled();
    expect(razorpayOptions.order_id).toBe('order_1');
  });

  it('should manage snapshots, diffs, and comments', () => {
    const { component, versionService, commentService, fileService } = createComponent();
    const selected = file();
    const firstSnapshot = snapshot({ snapshotId: 'snap-old', createdAt: '2026-01-01T00:00:00Z' });
    const newSnapshot = snapshot({ snapshotId: 'snap-new', content: 'new content', createdAt: '2026-02-01T00:00:00Z' });
    component.project = project();
    component.selectedFile = selected;
    component.files = [selected];
    component.filteredFiles = [selected];
    component.snapshots = [firstSnapshot];
    component.editorContent = 'new content';
    component.snapshotMessage = ' Save work ';
    versionService.createSnapshot.mockReturnValue(of(newSnapshot));
    versionService.restoreSnapshot.mockReturnValue(of(newSnapshot));
    versionService.createBranch.mockReturnValue(of({ ...newSnapshot, branch: 'feature' }));
    versionService.tagSnapshot.mockReturnValue(of({ ...newSnapshot, tag: 'v1' }));
    versionService.diffSnapshots.mockReturnValue(of({ snapshotIdOne: 'snap-new', snapshotIdTwo: 'snap-old', diffResult: '+new' }));
    fileService.updateFileContent.mockReturnValue(of({ ...selected, content: 'new content' }));

    component.createSnapshot();
    expect(versionService.createSnapshot).toHaveBeenCalledWith({
      projectId: 1,
      fileId: 10,
      authorId: currentUser.userId,
      message: 'Save work',
      content: 'new content',
      parentSnapshotId: 'snap-old',
      branch: 'main'
    });
    expect(component.snapshotMessage).toBe('');

    component.restoreSnapshot('snap-new');
    expect(component.saveMessage).toBe('Snapshot restored and synced to the file service.');

    component.diffSnapshotOne = 'snap-new';
    component.diffSnapshotTwo = 'snap-old';
    component.branchName = ' feature ';
    component.tagName = ' v1 ';
    component.createBranch();
    component.tagSnapshot();
    component.loadDiff();

    expect(versionService.createBranch).toHaveBeenCalledWith('snap-new', 'feature');
    expect(versionService.tagSnapshot).toHaveBeenCalledWith('snap-new', 'v1');
    expect(component.tagName).toBe('');
    expect(component.diffResult).toBe('+new');

    const addedComment = comment({ commentId: 20, content: 'Nice' });
    const reply = comment({ commentId: 21, parentCommentId: 20, content: 'Thanks' });
    commentService.addComment.mockReturnValue(of(addedComment));
    commentService.replyToComment.mockReturnValue(of(reply));
    commentService.resolveComment.mockReturnValue(of({ ...addedComment, resolved: true }));
    component.commentContent = ' Nice ';
    component.commentLineNumber = 4;
    component.addComment();
    expect(component.comments[0]).toEqual(addedComment);
    expect(component.commentContent).toBe('');

    component.replyContentByCommentId[20] = ' Thanks ';
    component.replyToComment(addedComment);
    expect(component.comments[0]).toEqual(reply);

    component.toggleResolve(addedComment);
    expect(commentService.resolveComment).toHaveBeenCalledWith(20);
  });

  it('should create, join, invite, and end collaboration sessions', () => {
    const { component, collabService, collabRealtimeService } = createComponent();
    const active = session();
    const joinedParticipant = participant({ userId: currentUser.userId, participantId: 7 });
    component.project = project({
      contributors: [{ userId: 8, username: 'dev-b' }]
    });
    component.selectedFile = file();
    collabService.createSession.mockReturnValue(of(active));
    collabService.getParticipants.mockReturnValue(of([joinedParticipant]));
    collabService.joinSession.mockReturnValue(of(joinedParticipant));
    collabService.sendSessionInvite.mockReturnValue(of('queued'));
    collabService.endSession.mockReturnValue(of('ended'));

    component.createSession();
    expect(component.sessions[0]).toEqual(active);
    expect(collabRealtimeService.connect).toHaveBeenCalledWith('session-1', currentUser.userId);

    component.joinSession('session-1');
    expect(component.participants.some((item) => item.userId === currentUser.userId)).toBe(true);

    component.inviteRecipient = 'dev-b';
    component.sendInvite();
    expect(collabService.sendSessionInvite).toHaveBeenCalledWith('session-1', {
      recipientId: 8,
      actorId: currentUser.userId,
      title: 'Session invite: CodeSync',
      message: 'Join session session-1 for Main.java.'
    });
    expect(component.saveMessage).toBe('Invite notification queued.');

    component.endSession('session-1');
    expect(component.sessions[0].status).toBe('ENDED');
  });

  it('should update editor indentation on Enter without changing runtime behavior', () => {
    const { component } = createComponent();
    component.project = project({ language: 'TypeScript' });
    component.selectedFile = file({ language: 'TypeScript', content: 'if (ok) {}' });
    component.editorContent = 'if (ok) {}';
    const setSelectionRange = vi.fn();
    const textarea = {
      value: 'if (ok) {}',
      selectionStart: 'if (ok) {'.length,
      selectionEnd: 'if (ok) {'.length,
      setSelectionRange
    };
    (component as any).codeEditor = { nativeElement: textarea };
    const event = {
      key: 'Enter',
      shiftKey: false,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault: vi.fn()
    } as unknown as KeyboardEvent;

    component.handleEditorKeydown(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(component.editorContent).toBe('if (ok) {\n  \n}');
    expect(textarea.value).toBe('if (ok) {\n  \n}');
    expect(setSelectionRange).toHaveBeenCalledWith('if (ok) {'.length + 3, 'if (ok) {'.length + 3);
  });

  it('should load workspace data and apply live refresh updates', () => {
    const {
      component,
      liveRefreshService,
      projectService,
      fileService,
      executionService,
      versionService,
      commentService,
      collabService,
      paymentService
    } = createComponent();
    const selected = file({ content: 'initial' });
    const folder = file({ fileId: 11, name: 'src', path: 'src', folder: true, content: '' });
    const currentExecution = execution({ createdAt: new Date(Date.now() + 1000).toISOString() });
    projectService.getProjectById.mockReturnValue(of(project({ updatedAt: '2026-04-01T00:00:00Z' })));
    fileService.getProjectFiles.mockReturnValue(of([selected, folder]));
    fileService.getFileContent.mockReturnValue(of('remote content'));
    executionService.getExecutionsByProject.mockReturnValue(of([currentExecution]));
    versionService.getFileHistory.mockReturnValue(of([snapshot({ createdAt: '2026-04-01T00:00:00Z' })]));
    commentService.getCommentsByFile.mockReturnValue(of([comment({ createdAt: '2026-04-01T00:00:00Z' })]));
    collabService.getSessionsByProject.mockReturnValue(of([session()]));
    collabService.getParticipants.mockReturnValue(of([participant({ userId: currentUser.userId, participantId: 7 })]));
    paymentService.hasExecutionPass.mockReturnValue(true);
    (liveRefreshService.poll as any).mockImplementation((factory: () => any) =>
      factory().pipe(map((data: unknown) => ({ ok: true, data })))
    );

    component.ngOnInit();

    expect(component.supportedLanguages).toEqual([{ language: 'Java', version: '21' }]);
    expect(component.project?.updatedAt).toBe('2026-04-01T00:00:00Z');
    expect(component.loading).toBe(false);
    expect(component.files.map((item) => item.fileId)).toEqual([11, 10]);
    expect(component.selectedFile?.fileId).toBe(10);
    expect(component.editorContent).toBe('remote content');
    expect(component.executions).toEqual([currentExecution]);
    expect(component.selectedFileExecutionCount).toBe(1);
    expect(component.hasExecutionPass).toBe(true);
    expect(component.snapshots.length).toBe(1);
    expect(component.comments.length).toBe(1);
    expect(component.sessions.length).toBe(1);
    expect(component.participants.some((item) => item.userId === currentUser.userId)).toBe(true);
  });

  it('should join a collaboration session from the workspace session link', () => {
    const { component, projectService, fileService, executionService, collabService, collabRealtimeService } =
      createComponent(currentUser, { session: 'session-1' });
    const active = session({ ownerId: 8 });
    const joinedParticipant = participant({ userId: currentUser.userId, participantId: 7 });
    projectService.getProjectById.mockReturnValue(of(project()));
    fileService.getProjectFiles.mockReturnValue(of([file()]));
    executionService.getExecutionsByProject.mockReturnValue(of([]));
    collabService.getSessionsByProject.mockReturnValue(of([active]));
    collabService.getParticipants
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(of([joinedParticipant]));
    collabService.joinSession.mockReturnValue(of(joinedParticipant));

    component.ngOnInit();

    expect(collabService.joinSession).toHaveBeenCalledWith('session-1', currentUser.userId, 'EDITOR', '');
    expect(collabRealtimeService.connect).toHaveBeenCalledWith('session-1', currentUser.userId);
    expect(component.participants.some((item) => item.userId === currentUser.userId)).toBe(true);
  });

  it('should block guests from private workspaces and show project load errors', () => {
    const guestSetup = createComponent(null);
    guestSetup.projectService.getProjectById.mockReturnValue(of(project({ visibility: 'PRIVATE' })));

    guestSetup.component.ngOnInit();

    expect(guestSetup.component.project).toBeNull();
    expect(guestSetup.component.loading).toBe(false);
    expect(guestSetup.component.errorMessage).toContain('Guests can only view public projects');

    TestBed.resetTestingModule();

    const errorSetup = createComponent();
    errorSetup.projectService.getProjectById.mockReturnValue(throwError(() => new Error('offline')));

    errorSetup.component.ngOnInit();

    expect(errorSetup.component.loading).toBe(false);
    expect(errorSetup.component.errorMessage).toBe('Project could not be loaded. Check the project service and try again.');
  });

  it('should rename, move, cancel, copy, kick, and delete through existing actions', () => {
    const { component, fileService, executionService, collabService, projectService, router } = createComponent();
    const selected = file();
    const renamed = file({ name: 'Renamed.java', path: 'src/Renamed.java' });
    const moved = file({ path: 'app/Renamed.java' });
    const active = session();
    component.project = project();
    component.selectedFile = selected;
    component.files = [selected];
    component.filteredFiles = [selected];
    component.sessions = [active];
    component.participants = [participant({ userId: currentUser.userId, participantId: 7 }), participant({ userId: 8 })];
    fileService.renameFile.mockReturnValue(of(renamed));
    fileService.moveFile.mockReturnValue(of(moved));
    executionService.cancelExecution.mockReturnValue(of(execution({ jobId: 'job-1', status: 'CANCELLED' })));
    collabService.kickParticipant.mockReturnValue(of('removed'));
    projectService.deleteProject.mockReturnValue(of('deleted'));
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce(' Renamed.java ')
      .mockReturnValueOnce(' app/Renamed.java ');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const writeText = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    component.renameSelectedFile();
    expect(fileService.renameFile).toHaveBeenCalledWith(10, 'Renamed.java');
    expect(component.selectedFile).toEqual(renamed);

    component.moveSelectedFile();
    expect(fileService.moveFile).toHaveBeenCalledWith(10, 'app/Renamed.java');
    expect(component.selectedFile).toEqual(moved);

    component.executions = [execution({ jobId: 'job-1', status: 'RUNNING' })];
    component.cancelExecution('job-1');
    expect(component.executions[0].status).toBe('CANCELLED');

    component.copySessionLink(active);
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/projects/1?session=session-1`);
    expect(component.saveMessage).toBe('Session share link copied.');

    component.kickParticipant(participant({ userId: 8 }));
    expect(component.participants.some((item) => item.userId === 8)).toBe(false);

    component.deleteProject();
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('should send cursor and content updates through realtime or REST fallback', () => {
    const { component, collabRealtimeService, collabService } = createComponent();
    const active = session();
    component.project = project();
    component.selectedFile = file({ content: 'line one\nline two' });
    component.editorContent = 'line one\nline two';
    component.sessions = [active];
    component.participants = [participant({ userId: currentUser.userId, participantId: 7, sessionId: active.sessionId })];
    component.realtimeConnected = true;
    (component as any).activeEditorCursorUserIds.add(currentUser.userId);
    const textarea = document.createElement('textarea');
    textarea.value = 'line one\nline two';
    textarea.selectionStart = 12;
    textarea.selectionEnd = 12;
    (component as any).codeEditor = { nativeElement: textarea };

    component.updateCursor();
    component.onEditorContentChange('updated');

    expect(collabRealtimeService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CURSOR_UPDATE',
        sessionId: 'session-1',
        userId: currentUser.userId,
        fileId: 10,
        cursorLine: 2,
        cursorCol: 4
      })
    );
    expect(collabRealtimeService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CONTENT_CHANGE',
        content: 'updated'
      })
    );

    component.realtimeConnected = false;
    collabService.updateCursor.mockReturnValue(of(participant({ userId: currentUser.userId, cursorLine: 2, cursorCol: 4 })));
    component.updateCursor();
    expect(collabService.updateCursor).toHaveBeenCalledWith('session-1', currentUser.userId, 2, 4);

    component.realtimeConnected = true;
    component.clearLocalEditorCursor();
    expect(collabRealtimeService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'CURSOR_UPDATE',
        cursorLine: null,
        cursorCol: null
      })
    );
  });

  it('should merge realtime content, cursor, names, and connection events', async () => {
    const { component, collabRealtimeService, collabService } = createComponent();
    const active = session({ ownerId: currentUser.userId });
    component.project = project();
    component.selectedFile = file({ content: 'old' });
    component.sessions = [active];
    component.participants = [
      participant({ userId: currentUser.userId, participantId: 7 }),
      participant({ userId: 8, participantId: 8, fullName: 'Remote Dev' })
    ];
    component.realtimeConnected = true;
    collabService.getParticipants.mockReturnValue(of([participant({ userId: 8, fullName: 'Remote Dev' })]));

    (component as any).handleRealtimeMessage({
      type: 'CONTENT_CHANGE',
      sessionId: 'session-1',
      clientId: 'client-2',
      userId: 8,
      fileId: 10,
      content: 'remote edit',
      cursorLine: 3,
      cursorCol: 5,
      participant: participant({ userId: 8, fullName: 'Remote Dev' })
    });
    await Promise.resolve();

    expect(component.editorContent).toBe('remote edit');
    expect(component.participants.some((item) => item.userId === 8)).toBe(true);

    (component as any).handleRealtimeMessage({
      type: 'PARTICIPANT_NAME',
      sessionId: 'session-1',
      userId: 9,
      content: 'Named User'
    });
    expect(component.participants.some((item) => item.userId === 9 && item.fullName === 'Named User')).toBe(true);

    (component as any).handleRealtimeMessage({
      type: 'USER_CONNECTED',
      sessionId: 'session-1',
      userId: 10,
      content: '',
      participant: participant({ userId: 10 })
    });
    expect(collabService.getParticipants).toHaveBeenCalledWith('session-1');

    (component as any).handleRealtimeMessage({
      type: 'USER_CONNECTED',
      sessionId: 'session-1',
      userId: 11,
      content: ''
    });
    expect(collabRealtimeService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'PARTICIPANT_NAME',
        sessionId: 'session-1'
      })
    );
    expect(collabService.getParticipants).toHaveBeenCalledWith('session-1');

    (component as any).handleRealtimeMessage({
      type: 'USER_DISCONNECTED',
      sessionId: 'session-1',
      userId: 8
    });
    expect(collabService.getParticipants).toHaveBeenCalledWith('session-1');
  });

  it('should handle project execution, live file, participant profile, and invite helper branches', () => {
    const { component, authService } = createComponent();
    const selected = file();
    const replacement = file({ fileId: 12, name: 'Next.java', path: 'Next.java', content: 'next' });
    component.project = project({
      ownerId: 42,
      ownerFullName: 'Project Owner',
      contributors: [{ userId: 13, email: 'contributor@example.com' }]
    });
    component.selectedFile = selected;
    component.files = [selected];
    component.filteredFiles = [selected];
    component.projectSearch = 'next';
    component.editorContent = 'local changes';
    (component as any).applyLiveFiles([replacement]);

    expect(component.selectedFile).toEqual(replacement);
    expect(component.editorContent).toBe('next');
    expect(component.filteredFiles).toEqual([replacement]);

    (component as any).applyProjectExecutions([
      execution({ jobId: 'old', fileId: 12, createdAt: '2020-01-01T00:00:00Z' }),
      execution({ jobId: 'new', fileId: 12, createdAt: new Date(Date.now() + 1000).toISOString() })
    ]);
    expect(component.executions.map((item) => item.jobId)).toEqual(['new', 'old']);
    expect(component.selectedFileExecutionCount).toBe(2);

    (component as any).applyProjectExecutions([
      execution({
        jobId: 'new',
        fileId: 12,
        status: 'RUNNING',
        stdout: '',
        exitCode: null,
        completedAt: null,
        createdAt: new Date(Date.now() + 1000).toISOString()
      })
    ]);
    expect(component.executions.find((item) => item.jobId === 'new')?.stdout).toBe('ok');

    expect((component as any).resolveInviteRecipientId('13')).toBe(13);
    expect((component as any).resolveInviteRecipientId('contributor@example.com')).toBe(13);
    expect(component.getParticipantDisplayName(participant({ userId: 42, username: undefined, fullName: undefined }))).toBe('owner');

    authService.getUsersByIds.mockReturnValue(throwError(() => new Error('offline')));
    (component as any).loadParticipantProfiles([88], true);
    expect(authService.getUsersByIds).toHaveBeenCalledWith([88]);
  });

  it('should preserve existing workspace edge and failure behavior', () => {
    const {
      component,
      fileService,
      executionService,
      versionService,
      commentService,
      collabService,
      paymentService,
      projectService,
      collabRealtimeService,
      router
    } = createComponent();
    const selected = file({ language: 'Python', content: 'print("hi")' });
    component.project = project({
      language: 'Python',
      contributors: [{ userId: 8, username: 'dev-b' }],
      contributorIds: [9],
      contributorUsernames: ['dev-c']
    });
    component.selectedFile = selected;
    component.files = [selected];
    component.filteredFiles = [selected];

    component.projectSearch = 'main';
    component.project = null;
    component.filterFiles();
    expect(fileService.searchInProject).not.toHaveBeenCalled();
    component.project = project({ language: 'Python', contributors: [{ userId: 8, username: 'dev-b' }] });

    component.sessions = [session({ ownerId: 99 })];
    component.saveFile();
    expect(component.errorMessage).toBe('Join the active collaboration session before modifying this workspace.');
    component.sessions = [];

    component.newFileName = 'Broken.py';
    fileService.createFile.mockReturnValue(throwError(() => new Error('offline')));
    component.createFile();
    expect(component.errorMessage).toBe('Could not create the file.');

    component.newFolderName = 'pkg';
    fileService.createFolder.mockReturnValue(throwError(() => new Error('offline')));
    component.createFolder();
    expect(component.errorMessage).toBe('Could not create the folder.');

    fileService.updateFileContent.mockReturnValue(throwError(() => new Error('offline')));
    component.saveFile();
    expect(component.errorMessage).toBe('Could not save file changes.');

    fileService.deleteFile.mockReturnValue(throwError(() => new Error('offline')));
    component.deleteSelectedFile();
    expect(component.errorMessage).toBe('Could not delete the file.');

    const prompt = vi.spyOn(window, 'prompt');
    prompt.mockReturnValueOnce('').mockReturnValueOnce('Renamed.py').mockReturnValueOnce(selected.path).mockReturnValueOnce('src/Renamed.py');
    component.renameSelectedFile();
    expect(fileService.renameFile).not.toHaveBeenCalled();

    fileService.renameFile.mockReturnValue(throwError(() => new Error('offline')));
    component.renameSelectedFile();
    expect(component.errorMessage).toBe('Could not rename the file.');

    component.moveSelectedFile();
    expect(fileService.moveFile).not.toHaveBeenCalled();

    fileService.moveFile.mockReturnValue(throwError(() => new Error('offline')));
    component.moveSelectedFile();
    expect(component.errorMessage).toBe('Could not move the file.');

    component.editorContent = 'print("hi")';
    executionService.submitExecution.mockReturnValue(throwError(() => new Error('offline')));
    component.runCode();
    expect(executionService.submitExecution).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'Python',
        sourceCode: 'print("hi")'
      })
    );
    expect(component.errorMessage).toBe('Could not submit execution.');

    component.paymentLoading = true;
    component.startExecutionPassPayment();
    expect(paymentService.createOrder).not.toHaveBeenCalled();

    component.paymentLoading = false;
    paymentService.createOrder.mockReturnValue(throwError(() => new Error('offline')));
    component.startExecutionPassPayment();
    expect(component.errorMessage).toBe('Could not start Razorpay payment. Check payment configuration.');

    component.snapshotMessage = 'Save';
    versionService.createSnapshot.mockReturnValue(throwError(() => new Error('offline')));
    component.createSnapshot();
    expect(component.errorMessage).toBe('Could not create the snapshot.');

    versionService.restoreSnapshot
      .mockReturnValueOnce(throwError(() => new Error('offline')))
      .mockReturnValueOnce(of(snapshot({ snapshotId: 'restored', content: 'restored' })));
    component.restoreSnapshot('snap-1');
    expect(component.errorMessage).toBe('Could not restore the snapshot.');

    component.restoreSnapshot('snap-1');
    expect(component.errorMessage).toBe('Snapshot record restored, but file content sync failed.');

    component.diffSnapshotOne = 'snap-1';
    component.diffSnapshotTwo = 'snap-2';
    component.branchName = 'feature';
    component.tagName = 'v1';
    versionService.createBranch.mockReturnValue(throwError(() => new Error('offline')));
    versionService.tagSnapshot.mockReturnValue(throwError(() => new Error('offline')));
    versionService.diffSnapshots.mockReturnValue(throwError(() => new Error('offline')));
    component.createBranch();
    expect(component.errorMessage).toBe('Could not create the branch.');
    component.tagSnapshot();
    expect(component.errorMessage).toBe('Could not tag the snapshot.');
    component.loadDiff();
    expect(component.errorMessage).toBe('Could not load the diff.');

    const baseComment = comment({ commentId: 20, resolved: true });
    component.comments = [baseComment];
    component.commentContent = 'Note';
    commentService.addComment.mockReturnValue(throwError(() => new Error('offline')));
    component.addComment();
    expect(component.errorMessage).toBe('Could not add the comment.');

    component.replyContentByCommentId[20] = 'Reply';
    commentService.replyToComment.mockReturnValue(throwError(() => new Error('offline')));
    component.replyToComment(baseComment);
    expect(component.errorMessage).toBe('Could not add the reply.');

    commentService.unresolveComment.mockReturnValue(throwError(() => new Error('offline')));
    component.toggleResolve(baseComment);
    expect(component.errorMessage).toBe('Could not update the comment state.');

    component.passwordProtected = true;
    component.sessionPassword = 'secret';
    collabService.createSession.mockReturnValue(throwError(() => new Error('offline')));
    component.createSession();
    expect(component.errorMessage).toBe('Could not create the collaboration session.');

    collabService.joinSession.mockReturnValue(throwError(() => ({ error: { message: 'Bad password' } })));
    component.joinSession('session-1');
    expect(component.errorMessage).toBe('Bad password');

    component.sessions = [session()];
    component.inviteRecipient = 'unknown-user';
    component.sendInvite();
    expect(component.errorMessage).toBe('Enter a valid project username, name, email, or user id.');

    component.inviteRecipient = String(currentUser.userId);
    component.sendInvite();
    expect(component.errorMessage).toBe('You cannot invite yourself to the session.');

    component.inviteRecipient = 'dev-b';
    collabService.sendSessionInvite.mockReturnValue(throwError(() => new Error('offline')));
    component.sendInvite();
    expect(component.errorMessage).toBe('Could not send the invite notification.');

    collabService.kickParticipant.mockReturnValue(throwError(() => ({ error: 'Cannot remove participant' })));
    component.participants = [participant({ userId: 8 })];
    component.kickParticipant(participant({ userId: 8 }));
    expect(component.errorMessage).toBe('Cannot remove participant');

    component.sessions = [session({ ownerId: 99 })];
    component.endSession('session-1');
    expect(component.errorMessage).toBe('Only the session host can end the collaboration session.');

    component.sessions = [session()];
    collabService.endSession.mockReturnValue(throwError(() => new Error('offline')));
    component.endSession('session-1');
    expect(component.errorMessage).toBe('Could not end the session.');

    const confirm = vi.spyOn(window, 'confirm');
    confirm.mockReturnValueOnce(false).mockReturnValueOnce(true);
    component.deleteProject();
    expect(router.navigate).not.toHaveBeenCalled();

    projectService.deleteProject.mockReturnValue(throwError(() => new Error('offline')));
    component.deleteProject();
    expect(component.errorMessage).toBe('Could not delete the project right now.');

    collabService.getParticipants.mockReturnValue(throwError(() => new Error('offline')));
    (component as any).loadParticipants('session-1');
    expect(component.participants).toEqual([]);

    collabService.updateCursor.mockReturnValue(throwError(() => new Error('offline')));
    component.participants = [participant({ userId: currentUser.userId, participantId: 7 })];
    component.updateCursor();
    expect(component.errorMessage).toBe('Could not update cursor position.');

    (component as any).handleRealtimeMessage({
      type: 'USER_DISCONNECTED',
      sessionId: 'session-1',
      clientId: collabRealtimeService.clientId,
      userId: 8
    });
    (component as any).handleRealtimeMessage({
      type: 'CONTENT_CHANGE',
      sessionId: 'missing-session',
      userId: 88,
      fileId: selected.fileId,
      content: 'ignored'
    });
    expect(component.editorContent).not.toBe('ignored');

    (component as any).applySelectedFileContent(99, 'other');
    component.editorContent = 'local edit';
    component.selectedFile = { ...selected, content: 'server version' };
    (component as any).applySelectedFileContent(selected.fileId, 'remote version');
    expect(component.editorContent).toBe('local edit');

    expect(component.getSnapshotAuthorName(snapshot({ authorId: 99, authorUsername: 'snap-author' }))).toBe('snap-author');
    expect(component.getParticipantDisplayName(participant({ userId: 404, username: undefined, fullName: undefined, email: undefined }))).toBe('Loading name...');
  });
});
