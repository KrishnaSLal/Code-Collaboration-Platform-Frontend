import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription, forkJoin } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { CollabService } from '../../core/services/collab.service';
import { ExecutionService } from '../../core/services/execution.service';
import { LiveRefreshService } from '../../core/services/live-refresh.service';
import { NotificationService } from '../../core/services/notification.service';
import {
  EXECUTION_PASS_PLAN_NAME,
  EXECUTION_PASS_PRICE_IN_PAISE,
  FREE_EXECUTION_LIMIT,
  PaymentOrderResponse,
  PaymentService
} from '../../core/services/payment.service';
import { ProjectService } from '../../core/services/project.service';
import { ExecutionStats, LanguageInfo, NotificationItem, Project } from '../../core/models/codesync.model';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly freeExecutionLimit = FREE_EXECUTION_LIMIT;
  readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly projectService = inject(ProjectService);
  private readonly collabService = inject(CollabService);
  private readonly notificationService = inject(NotificationService);
  private readonly executionService = inject(ExecutionService);
  private readonly paymentService = inject(PaymentService);
  private readonly liveRefreshService = inject(LiveRefreshService);
  private readonly router = inject(Router);
  private readonly subscriptions = new Subscription();
  private executionStatsSubscription = new Subscription();

  readonly createProjectForm = this.fb.group({
    projectName: ['', [Validators.required, Validators.minLength(3)]],
    description: [''],
    language: ['Java', [Validators.required]],
    visibility: ['PUBLIC', [Validators.required]]
  });

  myProjects: Project[] = [];
  publicProjects: Project[] = [];
  notifications: NotificationItem[] = [];
  supportedLanguages: LanguageInfo[] = [];
  unreadCount = 0;
  executionStats: ExecutionStats | null = null;
  loading = true;
  createProjectLoading = false;
  paymentLoading = false;
  paymentMessage = '';
  hasExecutionPass = false;
  errorMessage = '';

  ngOnInit(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    this.hasExecutionPass = this.paymentService.hasExecutionPass(currentUser.userId);

    this.subscriptions.add(
      this.liveRefreshService.poll(() => this.projectService.getProjectsByOwner(currentUser.userId)).subscribe((result) => {
        if (result.ok) {
          this.myProjects = this.sortProjects(result.data);
          this.loadExecutionStats(this.myProjects);
          this.loading = false;
          return;
        }

        if (this.loading) {
          this.errorMessage = 'Unable to load your projects.';
          this.loading = false;
        }
      })
    );

    this.subscriptions.add(
      this.liveRefreshService.poll(() => this.projectService.getPublicProjects()).subscribe((result) => {
        if (result.ok) {
          this.publicProjects = this.sortProjects(result.data).slice(0, 6);
          return;
        }

        if (!this.publicProjects.length) {
          this.publicProjects = [];
        }
      })
    );

    this.subscriptions.add(
      this.liveRefreshService
        .poll(() => this.notificationService.getByRecipient(currentUser.userId), 4000)
        .subscribe((result) => {
          if (result.ok) {
            this.notifications = this.sortNotifications(result.data);
            return;
          }

          if (!this.notifications.length) {
            this.notifications = [];
          }
        })
    );

    this.subscriptions.add(
      this.liveRefreshService
        .poll(() => this.notificationService.getUnreadCount(currentUser.userId), 4000)
        .subscribe((result) => {
          this.unreadCount = result.ok ? result.data.unreadCount : this.unreadCount;
        })
    );

    this.subscriptions.add(
      this.liveRefreshService.poll(() => this.executionService.getSupportedLanguages(), 60000).subscribe((result) => {
        if (result.ok) {
          this.supportedLanguages = result.data;
          return;
        }

        if (!this.supportedLanguages.length) {
          this.supportedLanguages = [];
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.executionStatsSubscription.unsubscribe();
    this.subscriptions.unsubscribe();
  }

  createProject(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser || this.createProjectForm.invalid) {
      this.createProjectForm.markAllAsTouched();
      return;
    }

    this.createProjectLoading = true;

    this.projectService
      .createProject({
        ownerId: currentUser.userId,
        projectName: this.createProjectForm.value.projectName?.trim() || '',
        description: this.createProjectForm.value.description?.trim() || '',
        language: this.createProjectForm.value.language || 'Java',
        visibility: this.createProjectForm.value.visibility || 'PUBLIC'
      })
      .subscribe({
        next: (project) => {
          this.createProjectLoading = false;
          this.myProjects = [project, ...this.myProjects];
          this.router.navigate(['/projects', project.projectId]);
        },
        error: () => {
          this.createProjectLoading = false;
          this.errorMessage = 'Project creation failed. Please check that the backend services are running.';
        }
      });
  }

  markAsRead(notificationId: number): void {
    this.notificationService.markAsRead(notificationId).subscribe({
      next: (updatedNotification) => {
        this.notifications = this.notifications.map((notification) =>
          notification.notificationId === updatedNotification.notificationId ? updatedNotification : notification
        );
        this.unreadCount = Math.max(0, this.unreadCount - 1);
      },
      error: () => {
        this.errorMessage = 'Could not mark notification as read right now.';
      }
    });
  }

  joinSessionFromNotification(notification: NotificationItem): void {
    if (notification.type !== 'SESSION_INVITE' || !notification.relatedId) {
      return;
    }

    this.collabService.getSessionById(notification.relatedId).subscribe({
      next: (session) => {
        this.router.navigate(['/projects', session.projectId], {
          queryParams: { session: session.sessionId }
        });
      },
      error: () => {
        this.errorMessage = 'Could not open the session invite right now.';
      }
    });
  }

  starProject(projectId: number): void {
    this.projectService.starProject(projectId).subscribe({
      next: (updatedProject) => {
        this.publicProjects = this.publicProjects.map((project) =>
          project.projectId === updatedProject.projectId ? updatedProject : project
        );
      },
      error: () => {
        this.errorMessage = 'Could not star the project right now.';
      }
    });
  }

  forkProject(projectId: number): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    this.projectService.forkProject(projectId, currentUser.userId).subscribe({
      next: (project) => {
        this.myProjects = [project, ...this.myProjects];
        this.loadExecutionStats(this.myProjects);
      },
      error: () => {
        this.errorMessage = 'Could not fork the project right now.';
      }
    });
  }

  deleteProject(project: Project): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser || project.ownerId !== currentUser.userId) {
      return;
    }

    const confirmed = window.confirm(`Delete "${project.projectName}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.projectService.deleteProject(project.projectId).subscribe({
      next: () => {
        this.myProjects = this.myProjects.filter((item) => item.projectId !== project.projectId);
        this.publicProjects = this.publicProjects.filter((item) => item.projectId !== project.projectId);
        this.loadExecutionStats(this.myProjects);
        this.executionService.deleteExecutionsByProject(project.projectId).subscribe({
          error: () => {
            this.errorMessage = 'Project deleted, but its execution history could not be cleaned up right now.';
          }
        });
        this.errorMessage = '';
      },
      error: () => {
        this.errorMessage = 'Could not delete the project right now.';
      }
    });
  }

  startProPayment(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser || this.hasExecutionPass) {
      return;
    }

    this.paymentLoading = true;
    this.paymentMessage = '';
    this.errorMessage = '';

    this.paymentService
      .createOrder({
        amount: EXECUTION_PASS_PRICE_IN_PAISE,
        currency: 'INR',
        planName: EXECUTION_PASS_PLAN_NAME,
        userId: currentUser.userId
      })
      .subscribe({
        next: (order) => this.openRazorpay(order),
        error: (error) => {
          this.paymentLoading = false;
          this.errorMessage = this.paymentService.getPaymentErrorMessage(
            error,
            'Could not start Razorpay payment. Check payment configuration.'
          );
        }
      });
  }

  private openRazorpay(order: PaymentOrderResponse): void {
    const currentUser = this.authService.currentUser();
    const checkout = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'CodeSync',
      description: EXECUTION_PASS_PLAN_NAME,
      order_id: order.orderId,
      prefill: {
        name: currentUser?.fullName,
        email: currentUser?.email
      },
      theme: {
        color: '#22c55e'
      },
      handler: (response: any) => {
        this.paymentService
          .verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature
          })
          .subscribe({
            next: (result) => {
              this.paymentLoading = false;
              if (result.verified) {
                this.paymentService.activateExecutionPass(currentUser!.userId);
                this.hasExecutionPass = true;
              }
              this.paymentMessage = result.message;
            },
            error: (error) => {
              this.paymentLoading = false;
              this.errorMessage = this.paymentService.getPaymentErrorMessage(
                error,
                'Payment completed, but verification failed.'
              );
            }
          });
      },
      modal: {
        ondismiss: () => {
          this.paymentLoading = false;
        }
      }
    });

    checkout.open();
  }

  private loadExecutionStats(projects: Project[]): void {
    if (!projects.length) {
      this.executionStats = {
        totalExecutions: 0,
        completedExecutions: 0,
        failedExecutions: 0,
        cancelledExecutions: 0
      };
      return;
    }

    this.executionStatsSubscription.unsubscribe();
    this.executionStatsSubscription = forkJoin(
      projects.map((project) => this.executionService.getExecutionsByProject(project.projectId))
    ).subscribe({
      next: (projectExecutions) => {
        const executions = projectExecutions.flat();
        this.executionStats = {
          totalExecutions: executions.length,
          completedExecutions: executions.filter((execution) => execution.status === 'COMPLETED').length,
          failedExecutions: executions.filter((execution) => execution.status === 'FAILED').length,
          cancelledExecutions: executions.filter((execution) => execution.status === 'CANCELLED').length
        };
      },
      error: () => {
        this.executionStats = null;
      }
    });
  }

  private sortProjects(projects: Project[]): Project[] {
    return [...projects].sort((left, right) =>
      new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    );
  }

  private sortNotifications(notifications: NotificationItem[]): NotificationItem[] {
    return [...notifications].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }
}
