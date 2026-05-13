import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CurrentUser } from '../../core/models/auth.model';
import { CollabSession, ExecutionResponse, NotificationItem, Project } from '../../core/models/codesync.model';
import { AuthService } from '../../core/services/auth.service';
import { CollabService } from '../../core/services/collab.service';
import { ExecutionService } from '../../core/services/execution.service';
import { LiveRefreshService } from '../../core/services/live-refresh.service';
import { NotificationService } from '../../core/services/notification.service';
import { EXECUTION_PASS_PLAN_NAME, EXECUTION_PASS_PRICE_IN_PAISE, PaymentService } from '../../core/services/payment.service';
import { ProjectService } from '../../core/services/project.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  const currentUser: CurrentUser = {
    userId: 7,
    fullName: 'Krishna Lal',
    email: 'krishna@example.com',
    token: 'token'
  };

  function project(overrides: Partial<Project>): Project {
    return {
      projectId: 1,
      ownerId: currentUser.userId,
      projectName: 'CodeSync',
      description: 'Editor',
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

  function execution(overrides: Partial<ExecutionResponse>): ExecutionResponse {
    return {
      jobId: 'job-1',
      projectId: 1,
      fileId: 1,
      userId: currentUser.userId,
      language: 'Java',
      sourceCode: 'class Main {}',
      stdin: '',
      status: 'COMPLETED',
      stdout: '',
      stderr: '',
      exitCode: 0,
      executionTimeMs: 100,
      memoryUsedKb: 256,
      createdAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:01Z',
      ...overrides
    };
  }

  function notification(overrides: Partial<NotificationItem>): NotificationItem {
    return {
      notificationId: 1,
      recipientId: currentUser.userId,
      actorId: 4,
      type: 'SESSION_INVITE',
      title: 'Invite',
      message: 'Join',
      relatedId: 'session-1',
      relatedType: 'COLLAB_SESSION',
      isRead: false,
      createdAt: '2026-01-01T00:00:00Z',
      ...overrides
    };
  }

  function session(overrides: Partial<CollabSession> = {}): CollabSession {
    return {
      sessionId: 'session-1',
      projectId: 42,
      fileId: 10,
      ownerId: 4,
      status: 'ACTIVE',
      language: 'Java',
      createdAt: '2026-01-01T00:00:00Z',
      endedAt: null,
      maxParticipants: 5,
      passwordProtected: false,
      ...overrides
    };
  }

  function createComponent(user: CurrentUser | null = currentUser) {
    const projectService = {
      getProjectsByOwner: vi.fn(),
      getPublicProjects: vi.fn(),
      createProject: vi.fn(),
      starProject: vi.fn(),
      forkProject: vi.fn(),
      deleteProject: vi.fn()
    };
    const notificationService = {
      getByRecipient: vi.fn(),
      getUnreadCount: vi.fn(),
      markAsRead: vi.fn()
    };
    const collabService = {
      getSessionById: vi.fn()
    };
    const executionService = {
      getSupportedLanguages: vi.fn(),
      getExecutionsByProject: vi.fn(() => of([] as ExecutionResponse[])),
      deleteExecutionsByProject: vi.fn(() => of('deleted'))
    };
    const paymentService = {
      hasExecutionPass: vi.fn(() => false),
      createOrder: vi.fn(),
      verifyPayment: vi.fn(),
      activateExecutionPass: vi.fn(),
      getPaymentErrorMessage: vi.fn((_error: unknown, fallback: string) => fallback)
    };
    const liveRefreshService = {
      poll: vi.fn()
    };
    const router = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { currentUser: vi.fn(() => user) } },
        { provide: ProjectService, useValue: projectService },
        { provide: CollabService, useValue: collabService },
        { provide: NotificationService, useValue: notificationService },
        { provide: ExecutionService, useValue: executionService },
        { provide: PaymentService, useValue: paymentService },
        { provide: LiveRefreshService, useValue: liveRefreshService },
        { provide: Router, useValue: router }
      ]
    });

    const component = TestBed.runInInjectionContext(() => new DashboardComponent());
    return {
      component,
      projectService,
      collabService,
      notificationService,
      executionService,
      paymentService,
      liveRefreshService,
      router
    };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should load dashboard streams and calculate execution stats', () => {
    const myOlder = project({ projectId: 1, updatedAt: '2026-01-01T00:00:00Z' });
    const myNewer = project({ projectId: 2, projectName: 'Newer', updatedAt: '2026-02-01T00:00:00Z' });
    const publicProjects = Array.from({ length: 7 }, (_, index) =>
      project({
        projectId: index + 10,
        ownerId: index,
        projectName: `Public ${index}`,
        updatedAt: `2026-01-0${Math.min(index + 1, 9)}T00:00:00Z`
      })
    );
    const olderNotification = notification({ notificationId: 1, createdAt: '2026-01-01T00:00:00Z' });
    const newerNotification = notification({ notificationId: 2, createdAt: '2026-03-01T00:00:00Z' });
    const { component, liveRefreshService, executionService, paymentService } = createComponent();

    liveRefreshService.poll
      .mockReturnValueOnce(of({ ok: true, data: [myOlder, myNewer] }))
      .mockReturnValueOnce(of({ ok: true, data: publicProjects }))
      .mockReturnValueOnce(of({ ok: true, data: [olderNotification, newerNotification] }))
      .mockReturnValueOnce(of({ ok: true, data: { recipientId: currentUser.userId, unreadCount: 3 } }))
      .mockReturnValueOnce(of({ ok: true, data: [{ language: 'Java', version: '21' }] }));
    executionService.getExecutionsByProject
      .mockReturnValueOnce(of([execution({ status: 'COMPLETED' })]))
      .mockReturnValueOnce(of([execution({ jobId: 'job-2', projectId: 2, status: 'FAILED' })]));
    paymentService.hasExecutionPass.mockReturnValue(true);

    component.ngOnInit();

    expect(component.hasExecutionPass).toBe(true);
    expect(component.loading).toBe(false);
    expect(component.myProjects.map((item) => item.projectId)).toEqual([2, 1]);
    expect(component.publicProjects.length).toBe(6);
    expect(component.notifications.map((item) => item.notificationId)).toEqual([2, 1]);
    expect(component.unreadCount).toBe(3);
    expect(component.supportedLanguages).toEqual([{ language: 'Java', version: '21' }]);
    expect(component.executionStats).toEqual({
      totalExecutions: 2,
      completedExecutions: 1,
      failedExecutions: 1,
      cancelledExecutions: 0
    });
  });

  it('should create a project with trimmed form values and navigate to it', () => {
    const created = project({ projectId: 99, projectName: 'Created' });
    const { component, projectService, router } = createComponent();
    projectService.createProject.mockReturnValue(of(created));

    component.createProjectForm.setValue({
      projectName: '  Created  ',
      description: '  Demo project  ',
      language: 'TypeScript',
      visibility: 'PRIVATE'
    });
    component.createProject();

    expect(projectService.createProject).toHaveBeenCalledWith({
      ownerId: currentUser.userId,
      projectName: 'Created',
      description: 'Demo project',
      language: 'TypeScript',
      visibility: 'PRIVATE'
    });
    expect(component.myProjects[0]).toBe(created);
    expect(router.navigate).toHaveBeenCalledWith(['/projects', 99]);
  });

  it('should reject invalid project creation without calling the API', () => {
    const { component, projectService } = createComponent();
    const markAllAsTouched = vi.spyOn(component.createProjectForm, 'markAllAsTouched');

    component.createProject();

    expect(markAllAsTouched).toHaveBeenCalled();
    expect(projectService.createProject).not.toHaveBeenCalled();
  });

  it('should update notifications, public stars, forks, and deletes', () => {
    const owned = project({ projectId: 1, ownerId: currentUser.userId });
    const updatedNotification = notification({ notificationId: 10, isRead: true });
    const starredProject = project({ projectId: 2, starCount: 5 });
    const forkedProject = project({ projectId: 3, projectName: 'Forked' });
    const { component, notificationService, projectService, executionService } = createComponent();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    component.unreadCount = 1;
    component.notifications = [notification({ notificationId: 10 })];
    notificationService.markAsRead.mockReturnValue(of(updatedNotification));
    component.markAsRead(10);
    expect(component.notifications).toEqual([updatedNotification]);
    expect(component.unreadCount).toBe(0);

    component.publicProjects = [project({ projectId: 2, starCount: 0 })];
    projectService.starProject.mockReturnValue(of(starredProject));
    component.starProject(2);
    expect(component.publicProjects).toEqual([starredProject]);

    component.myProjects = [];
    projectService.forkProject.mockReturnValue(of(forkedProject));
    component.forkProject(2);
    expect(component.myProjects).toEqual([forkedProject]);

    component.myProjects = [owned];
    component.publicProjects = [owned];
    projectService.deleteProject.mockReturnValue(of('deleted'));
    component.deleteProject(owned);
    expect(confirm).toHaveBeenCalled();
    expect(component.myProjects).toEqual([]);
    expect(component.publicProjects).toEqual([]);
    expect(executionService.deleteExecutionsByProject).toHaveBeenCalledWith(1);
  });

  it('should open session invite notifications with the session link', () => {
    const invite = notification({ relatedId: 'session-1' });
    const { component, collabService, router } = createComponent();
    collabService.getSessionById.mockReturnValue(of(session()));

    component.joinSessionFromNotification(invite);

    expect(collabService.getSessionById).toHaveBeenCalledWith('session-1');
    expect(router.navigate).toHaveBeenCalledWith(['/projects', 42], {
      queryParams: { session: 'session-1' }
    });
  });

  it('should surface API errors for dashboard actions', () => {
    const { component, notificationService, projectService } = createComponent();
    notificationService.markAsRead.mockReturnValue(throwError(() => new Error('offline')));
    projectService.starProject.mockReturnValue(throwError(() => new Error('offline')));

    component.markAsRead(1);
    expect(component.errorMessage).toBe('Could not mark notification as read right now.');

    component.starProject(1);
    expect(component.errorMessage).toBe('Could not star the project right now.');
  });

  it('should preserve existing dashboard behavior for stream and action failures', () => {
    const owned = project({ projectId: 4, ownerId: currentUser.userId });
    const { component, liveRefreshService, projectService, executionService, paymentService } = createComponent();

    liveRefreshService.poll.mockReturnValue(of({ ok: false, data: null }));
    component.ngOnInit();
    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Unable to load your projects.');
    expect(component.publicProjects).toEqual([]);
    expect(component.notifications).toEqual([]);
    expect(component.supportedLanguages).toEqual([]);

    component.createProjectForm.setValue({
      projectName: 'Broken',
      description: '',
      language: 'Java',
      visibility: 'PUBLIC'
    });
    projectService.createProject.mockReturnValue(throwError(() => new Error('offline')));
    component.createProject();
    expect(component.createProjectLoading).toBe(false);
    expect(component.errorMessage).toBe('Project creation failed. Please check that the backend services are running.');

    projectService.forkProject.mockReturnValue(throwError(() => new Error('offline')));
    component.forkProject(owned.projectId);
    expect(component.errorMessage).toBe('Could not fork the project right now.');

    component.myProjects = [owned];
    const confirm = vi.spyOn(window, 'confirm');
    confirm.mockReturnValueOnce(false);
    component.deleteProject(owned);
    expect(projectService.deleteProject).not.toHaveBeenCalled();

    confirm.mockReturnValueOnce(true);
    projectService.deleteProject.mockReturnValue(throwError(() => new Error('offline')));
    component.deleteProject(owned);
    expect(component.errorMessage).toBe('Could not delete the project right now.');

    component.hasExecutionPass = true;
    component.startProPayment();
    expect(paymentService.createOrder).not.toHaveBeenCalled();

    component.hasExecutionPass = false;
    paymentService.createOrder.mockReturnValue(throwError(() => new Error('offline')));
    component.startProPayment();
    expect(component.paymentLoading).toBe(false);
    expect(component.errorMessage).toBe('Could not start Razorpay payment. Check payment configuration.');

    (component as any).loadExecutionStats([]);
    expect(component.executionStats).toEqual({
      totalExecutions: 0,
      completedExecutions: 0,
      failedExecutions: 0,
      cancelledExecutions: 0
    });

    executionService.getExecutionsByProject.mockReturnValue(throwError(() => new Error('offline')));
    (component as any).loadExecutionStats([owned]);
    expect(component.executionStats).toBeNull();
  });

  it('should start and verify a Razorpay execution pass payment', () => {
    const { component, paymentService } = createComponent();
    let options: any;
    const openMock = vi.fn();
    (window as any).Razorpay = class {
      constructor(checkoutOptions: any) {
        options = checkoutOptions;
      }

      open = openMock;
    };
    paymentService.createOrder.mockReturnValue(
      of({
        keyId: 'rzp_test',
        orderId: 'order_1',
        amount: EXECUTION_PASS_PRICE_IN_PAISE,
        currency: 'INR',
        receipt: 'receipt_1'
      })
    );
    paymentService.verifyPayment.mockReturnValue(of({ verified: true, message: 'Payment verified' }));

    component.startProPayment();
    options.handler({
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig'
    });

    expect(paymentService.createOrder).toHaveBeenCalledWith({
      amount: EXECUTION_PASS_PRICE_IN_PAISE,
      currency: 'INR',
      planName: EXECUTION_PASS_PLAN_NAME,
      userId: currentUser.userId
    });
    expect(openMock).toHaveBeenCalled();
    expect(paymentService.verifyPayment).toHaveBeenCalledWith({
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'sig'
    });
    expect(paymentService.activateExecutionPass).toHaveBeenCalledWith(currentUser.userId);
    expect(component.hasExecutionPass).toBe(true);
    expect(component.paymentMessage).toBe('Payment verified');

    delete (window as any).Razorpay;
  });

  it('should handle Razorpay dismiss and unverified or failed verification states', () => {
    const { component, paymentService } = createComponent();
    let options: any;
    (window as any).Razorpay = class {
      constructor(checkoutOptions: any) {
        options = checkoutOptions;
      }

      open = vi.fn();
    };
    paymentService.createOrder.mockReturnValue(
      of({
        keyId: 'rzp_test',
        orderId: 'order_1',
        amount: EXECUTION_PASS_PRICE_IN_PAISE,
        currency: 'INR',
        receipt: 'receipt_1'
      })
    );

    paymentService.verifyPayment.mockReturnValue(of({ verified: false, message: 'Payment pending' }));
    component.startProPayment();
    options.handler({
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig'
    });
    expect(paymentService.activateExecutionPass).not.toHaveBeenCalled();
    expect(component.paymentMessage).toBe('Payment pending');

    paymentService.verifyPayment.mockReturnValue(throwError(() => new Error('offline')));
    component.startProPayment();
    options.handler({
      razorpay_order_id: 'order_1',
      razorpay_payment_id: 'pay_2',
      razorpay_signature: 'sig'
    });
    expect(component.errorMessage).toBe('Payment completed, but verification failed.');

    component.paymentLoading = true;
    options.modal.ondismiss();
    expect(component.paymentLoading).toBe(false);

    delete (window as any).Razorpay;
  });
});
