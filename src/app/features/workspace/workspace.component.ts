import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, distinctUntilChanged, map } from 'rxjs';
import { UserSummary } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';
import { CollabRealtimeService } from '../../core/services/collab-realtime.service';
import { CollabService } from '../../core/services/collab.service';
import { CommentService } from '../../core/services/comment.service';
import { ExecutionService } from '../../core/services/execution.service';
import { FileService } from '../../core/services/file.service';
import { LiveRefreshService } from '../../core/services/live-refresh.service';
import {
  EXECUTION_PASS_PLAN_NAME,
  EXECUTION_PASS_PRICE_IN_PAISE,
  FREE_EXECUTION_LIMIT,
  PaymentOrderResponse,
  PaymentService
} from '../../core/services/payment.service';
import { ProjectService } from '../../core/services/project.service';
import { VersionService } from '../../core/services/version.service';
import {
  CollabRealtimeMessage,
  CollabSession,
  CommentItem,
  DiffResponse,
  ExecutionResponse,
  LanguageInfo,
  Participant,
  Project,
  ProjectFile,
  Snapshot
} from '../../core/models/codesync.model';

type InviteRecipientCandidate = {
  userId?: number;
  username?: string;
  fullName?: string;
  email?: string;
};

type EditorCursorIndicator = {
  userId: number;
  label: string;
  color: string;
  left: number;
  top: number;
  height: number;
};

@Component({
  selector: 'app-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './workspace.component.html',
  styleUrl: './workspace.component.css'
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  @ViewChild('codeEditor') private codeEditor?: ElementRef<HTMLTextAreaElement>;

  readonly freeExecutionLimit = FREE_EXECUTION_LIMIT;
  readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectService = inject(ProjectService);
  private readonly fileService = inject(FileService);
  private readonly executionService = inject(ExecutionService);
  private readonly versionService = inject(VersionService);
  private readonly commentService = inject(CommentService);
  private readonly collabService = inject(CollabService);
  private readonly collabRealtimeService = inject(CollabRealtimeService);
  private readonly liveRefreshService = inject(LiveRefreshService);
  private readonly paymentService = inject(PaymentService);

  project: Project | null = null;
  files: ProjectFile[] = [];
  filteredFiles: ProjectFile[] = [];
  supportedLanguages: LanguageInfo[] = [];
  selectedFile: ProjectFile | null = null;
  editorContent = '';
  projectSearch = '';
  executions: ExecutionResponse[] = [];
  snapshots: Snapshot[] = [];
  comments: CommentItem[] = [];
  sessions: CollabSession[] = [];
  participants: Participant[] = [];
  participantProfiles: Record<number, UserSummary> = {};
  private projectExecutions: ExecutionResponse[] = [];
  diffResult = '';
  loading = true;
  errorMessage = '';
  saveMessage = '';
  paymentMessage = '';
  executionLimitMessage = '';
  newFileName = '';
  newFolderName = '';
  newFileLanguage = 'Java';
  stdin = '';
  snapshotMessage = '';
  branchName = 'main';
  tagName = '';
  commentLineNumber: number | null = null;
  commentContent = '';
  replyContentByCommentId: Record<number, string> = {};
  diffSnapshotOne = '';
  diffSnapshotTwo = '';
  maxParticipants = 5;
  passwordProtected = false;
  sessionPassword = '';
  inviteRecipient = '';
  realtimeConnected = false;
  paymentLoading = false;
  selectedFileExecutionCount = 0;
  hasExecutionPass = false;
  currentCursorLine = 1;
  currentCursorCol = 1;
  editorCursorIndicators: EditorCursorIndicator[] = [];
  private applyingRemoteContent = false;
  private readonly activeEditorCursorUserIds = new Set<number>();
  private readonly loadingParticipantProfileIds = new Set<number>();
  private readonly subscriptions = new Subscription();
  private workspaceLiveSubscriptions = new Subscription();
  private fileContextLiveSubscriptions = new Subscription();
  private linkedSessionId: string | null = null;
  private linkedSessionFileId: number | null = null;
  private joiningLinkedSessionId: string | null = null;

  ngOnInit(): void {
    this.subscriptions.add(
      this.collabRealtimeService.connected$.subscribe((connected) => {
        this.realtimeConnected = connected;
        if (connected) {
          this.announceCurrentParticipant();
          this.announceCurrentCursor();
        }
      })
    );

    this.subscriptions.add(
      this.collabRealtimeService.messages$.subscribe((message) => {
        this.handleRealtimeMessage(message);
      })
    );

    this.executionService.getSupportedLanguages().subscribe({
      next: (languages) => {
        this.supportedLanguages = languages;
      },
      error: () => {
        this.supportedLanguages = [];
      }
    });

    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.hasExecutionPass = this.paymentService.hasExecutionPass(currentUser.userId);
    }

    this.subscriptions.add(
      this.route.queryParamMap
        .pipe(
          map((params) => params.get('session')),
          distinctUntilChanged()
        )
        .subscribe((sessionId) => {
          this.linkedSessionId = sessionId;
          this.joiningLinkedSessionId = null;
          this.tryJoinLinkedSession();
        })
    );

    this.subscriptions.add(
      this.route.paramMap
        .pipe(
          map((params) => Number(params.get('projectId'))),
          distinctUntilChanged()
        )
        .subscribe((projectId) => {
          this.loadWorkspace(projectId);
        })
    );
  }

  ngOnDestroy(): void {
    this.workspaceLiveSubscriptions.unsubscribe();
    this.fileContextLiveSubscriptions.unsubscribe();
    this.subscriptions.unsubscribe();
    this.collabRealtimeService.disconnect();
  }

  get isReadOnly(): boolean {
    return !this.authService.currentUser();
  }

  get isOwner(): boolean {
    const currentUser = this.authService.currentUser();
    return !!currentUser && !!this.project && this.project.ownerId === currentUser.userId;
  }

  get isGuestBlocked(): boolean {
    return this.isReadOnly && this.project?.visibility !== 'PUBLIC';
  }

  get activeSession(): CollabSession | null {
    return this.sessions.find((session) => session.status === 'ACTIVE') || null;
  }

  get isSessionHost(): boolean {
    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    return !!currentUser && !!session && session.ownerId === currentUser.userId;
  }

  get hasJoinedActiveSession(): boolean {
    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    if (!currentUser || !session) {
      return false;
    }

    return this.isCurrentUserInSession(session);
  }

  get mustJoinActiveSession(): boolean {
    return !!this.activeSession && !this.hasJoinedActiveSession;
  }

  get canModifyWorkspace(): boolean {
    return !this.isReadOnly && !this.mustJoinActiveSession;
  }

  get isEditorReadOnly(): boolean {
    return !this.canModifyWorkspace || !!this.selectedFile?.folder;
  }

  getParticipantDisplayName(participant: Participant): string {
    return this.getUserDisplayName(participant.userId, participant);
  }

  get inviteRecipientOptions(): string[] {
    const currentUserId = this.authService.currentUser()?.userId;
    const options: string[] = [];
    const seenOptions = new Set<string>();

    this.getInviteRecipientCandidates()
      .filter((candidate) => candidate.userId !== currentUserId)
      .forEach((candidate) => {
        this.getInviteCandidateLabels(candidate).forEach((label) => {
          const key = this.normalizeInviteLookupValue(label);
          if (!key || seenOptions.has(key)) {
            return;
          }

          seenOptions.add(key);
          options.push(label.trim());
        });
      });

    return options.sort((left, right) => left.localeCompare(right));
  }

  getSnapshotAuthorName(snapshot: Snapshot): string {
    const profile = this.participantProfiles[snapshot.authorId];

    return (
      snapshot.authorUsername ||
      profile?.username ||
      snapshot.authorFullName ||
      profile?.fullName ||
      snapshot.authorEmail ||
      profile?.email ||
      this.getUserDisplayName(snapshot.authorId)
    );
  }

  filterFiles(): void {
    const keyword = this.projectSearch.trim().toLowerCase();

    if (!keyword) {
      this.filteredFiles = this.sortFiles(this.files);
      return;
    }

    if (!this.project) {
      return;
    }

    this.fileService.searchInProject(this.project.projectId, keyword).subscribe({
      next: (files) => {
        this.filteredFiles = this.sortFiles(files);
      },
      error: () => {
        this.filteredFiles = this.sortFiles(
          this.files.filter((file) =>
            file.name.toLowerCase().includes(keyword) ||
            file.path.toLowerCase().includes(keyword) ||
            file.content.toLowerCase().includes(keyword)
          )
        );
      }
    });
  }

  selectFile(file: ProjectFile): void {
    this.selectedFile = file;
    this.editorContent = file.content || '';
    this.snapshots = [];
    this.comments = [];
    this.diffResult = '';
    this.resetEditorCursorPresence();
    this.updateSelectedFileExecutionCount();
    this.applyVisibleExecutions();
    this.saveMessage = '';
    this.loadFileContext(file.fileId);
  }

  createFile(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.newFileName.trim()) {
      return;
    }

    this.fileService
      .createFile({
        projectId: this.project.projectId,
        name: this.newFileName.trim(),
        path: this.buildChildPath(this.newFileName.trim()),
        language: this.newFileLanguage,
        content: '',
        createdById: currentUser.userId
      })
      .subscribe({
        next: (file) => {
          this.files = this.sortFiles([...this.files, file]);
          this.filterFiles();
          this.newFileName = '';
          this.selectFile(file);
        },
        error: () => {
          this.errorMessage = 'Could not create the file.';
        }
      });
  }

  createFolder(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.newFolderName.trim()) {
      return;
    }

    this.fileService
      .createFolder({
        projectId: this.project.projectId,
        name: this.newFolderName.trim(),
        path: this.buildChildPath(this.newFolderName.trim()),
        createdById: currentUser.userId
      })
      .subscribe({
        next: (folder) => {
          this.files = this.sortFiles([...this.files, folder]);
          this.filterFiles();
          this.newFolderName = '';
        },
        error: () => {
          this.errorMessage = 'Could not create the folder.';
        }
      });
  }

  saveFile(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.selectedFile) {
      return;
    }

    this.fileService.updateFileContent(this.selectedFile.fileId, this.editorContent, currentUser.userId).subscribe({
      next: (updatedFile) => {
        this.selectedFile = updatedFile;
        this.files = this.sortFiles(this.files.map((file) => (file.fileId === updatedFile.fileId ? updatedFile : file)));
        this.filterFiles();
        this.saveMessage = 'Changes saved to file service.';
      },
      error: () => {
        this.errorMessage = 'Could not save file changes.';
      }
    });
  }

  deleteSelectedFile(): void {
    if (!this.selectedFile || !this.ensureCanModifyWorkspace()) {
      return;
    }

    this.fileService.deleteFile(this.selectedFile.fileId).subscribe({
      next: () => {
        this.files = this.files.filter((file) => file.fileId !== this.selectedFile?.fileId);
        this.filteredFiles = this.sortFiles(this.filteredFiles.filter((file) => file.fileId !== this.selectedFile?.fileId));
        this.selectedFile = this.filteredFiles.find((file) => !file.folder) || null;
        this.editorContent = this.selectedFile?.content || '';
        this.updateSelectedFileExecutionCount();
        this.applyVisibleExecutions();
        if (this.selectedFile) {
          this.loadFileContext(this.selectedFile.fileId);
        } else {
          this.stopFileContextLiveRefresh();
        }
      },
      error: () => {
        this.errorMessage = 'Could not delete the file.';
      }
    });
  }

  renameSelectedFile(): void {
    if (!this.selectedFile || !this.ensureCanModifyWorkspace()) {
      return;
    }

    const newName = window.prompt('Enter the new file or folder name', this.selectedFile.name);
    if (!newName?.trim()) {
      return;
    }

    this.fileService.renameFile(this.selectedFile.fileId, newName.trim()).subscribe({
      next: (updatedFile) => {
        this.selectedFile = updatedFile;
        this.files = this.sortFiles(this.files.map((file) => (file.fileId === updatedFile.fileId ? updatedFile : file)));
        this.filterFiles();
      },
      error: () => {
        this.errorMessage = 'Could not rename the file.';
      }
    });
  }

  moveSelectedFile(): void {
    if (!this.selectedFile || !this.ensureCanModifyWorkspace()) {
      return;
    }

    const newPath = window.prompt('Enter the new file or folder path', this.selectedFile.path);
    if (!newPath?.trim() || newPath.trim() === this.selectedFile.path) {
      return;
    }

    this.fileService.moveFile(this.selectedFile.fileId, newPath.trim()).subscribe({
      next: (updatedFile) => {
        this.selectedFile = updatedFile;
        this.files = this.sortFiles(this.files.map((file) => (file.fileId === updatedFile.fileId ? updatedFile : file)));
        this.filterFiles();
      },
      error: () => {
        this.errorMessage = 'Could not move the file.';
      }
    });
  }

  runCode(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.selectedFile || this.selectedFile.folder) {
      return;
    }

    if (!this.canRunCode()) {
      this.executionLimitMessage = `You have used ${this.freeExecutionLimit} free code runs for this file. Pay once with Razorpay to continue running code.`;
      this.startExecutionPassPayment();
      return;
    }

    this.executionLimitMessage = '';

    this.executionService
      .submitExecution({
        projectId: this.project.projectId,
        fileId: this.selectedFile.fileId,
        userId: currentUser.userId,
        language: this.selectedFile.language || this.project.language,
        sourceCode: this.getExecutableSourceCode(),
        stdin: this.stdin
      })
      .subscribe({
        next: (execution) => {
          this.projectExecutions = this.mergeExecutions(this.projectExecutions, [execution]);
          this.applyVisibleExecutions();
          this.updateSelectedFileExecutionCount();
        },
        error: () => {
          this.errorMessage = 'Could not submit execution.';
        }
      });
  }

  startExecutionPassPayment(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser || this.paymentLoading) {
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

  get remainingFreeRuns(): number {
    return Math.max(0, this.freeExecutionLimit - this.selectedFileExecutionCount);
  }

  private getExecutableSourceCode(): string {
    const language = (this.selectedFile?.language || this.project?.language || '').toLowerCase();

    if (language !== 'java') {
      return this.editorContent;
    }

    return this.normalizeJavaEntryPoint(this.editorContent);
  }

  private normalizeJavaEntryPoint(sourceCode: string): string {
    const classMatch = sourceCode.match(/\bpublic\s+class\s+([A-Za-z_$][\w$]*)/);
    const className = classMatch?.[1];

    if (!className || className === 'Main') {
      return sourceCode;
    }

    return sourceCode.replace(new RegExp(`\\b${this.escapeRegExp(className)}\\b`, 'g'), 'Main');
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private canRunCode(): boolean {
    return this.hasExecutionPass || this.selectedFileExecutionCount < this.freeExecutionLimit;
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
              if (result.verified && currentUser) {
                this.paymentService.activateExecutionPass(currentUser.userId);
                this.hasExecutionPass = true;
                this.executionLimitMessage = '';
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

  cancelExecution(jobId: string): void {
    this.executionService.cancelExecution(jobId).subscribe({
      next: (updatedExecution) => {
        this.projectExecutions = this.mergeExecutions(this.projectExecutions, [updatedExecution]);
        this.applyVisibleExecutions();
      },
      error: () => {
        this.errorMessage = 'Could not cancel the execution.';
      }
    });
  }

  createSnapshot(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.selectedFile || !this.snapshotMessage.trim()) {
      return;
    }

    const latestSnapshot = this.snapshots[0];

    this.versionService
      .createSnapshot({
        projectId: this.project.projectId,
        fileId: this.selectedFile.fileId,
        authorId: currentUser.userId,
        message: this.snapshotMessage.trim(),
        content: this.editorContent,
        parentSnapshotId: latestSnapshot?.snapshotId || null,
        branch: this.branchName.trim() || 'main'
      })
      .subscribe({
        next: (snapshot) => {
          this.applySnapshots([snapshot, ...this.snapshots]);
          this.snapshotMessage = '';
        },
        error: () => {
          this.errorMessage = 'Could not create the snapshot.';
        }
      });
  }

  restoreSnapshot(snapshotId: string): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.selectedFile) {
      return;
    }

    this.versionService.restoreSnapshot(snapshotId, currentUser.userId, 'Restore snapshot from workspace').subscribe({
      next: (snapshot) => {
        this.editorContent = snapshot.content;
        this.applySnapshots([snapshot, ...this.snapshots]);
        this.fileService.updateFileContent(this.selectedFile!.fileId, snapshot.content, currentUser.userId).subscribe({
          next: (updatedFile) => {
            this.selectedFile = updatedFile;
            this.files = this.sortFiles(this.files.map((file) => (file.fileId === updatedFile.fileId ? updatedFile : file)));
            this.filterFiles();
            this.saveMessage = 'Snapshot restored and synced to the file service.';
          },
          error: () => {
            this.errorMessage = 'Snapshot record restored, but file content sync failed.';
          }
        });
      },
      error: () => {
        this.errorMessage = 'Could not restore the snapshot.';
      }
    });
  }

  createBranch(): void {
    if (!this.diffSnapshotOne || !this.branchName.trim()) {
      return;
    }

    this.versionService.createBranch(this.diffSnapshotOne, this.branchName.trim()).subscribe({
      next: (snapshot) => {
        this.applySnapshots(
          this.snapshots.map((existing) =>
            existing.snapshotId === snapshot.snapshotId ? snapshot : existing
          )
        );
      },
      error: () => {
        this.errorMessage = 'Could not create the branch.';
      }
    });
  }

  tagSnapshot(): void {
    if (!this.diffSnapshotOne || !this.tagName.trim()) {
      return;
    }

    this.versionService.tagSnapshot(this.diffSnapshotOne, this.tagName.trim()).subscribe({
      next: (snapshot) => {
        this.applySnapshots(
          this.snapshots.map((existing) =>
            existing.snapshotId === snapshot.snapshotId ? snapshot : existing
          )
        );
        this.tagName = '';
      },
      error: () => {
        this.errorMessage = 'Could not tag the snapshot.';
      }
    });
  }

  loadDiff(): void {
    if (!this.diffSnapshotOne || !this.diffSnapshotTwo) {
      return;
    }

    this.versionService.diffSnapshots(this.diffSnapshotOne, this.diffSnapshotTwo).subscribe({
      next: (diff: DiffResponse) => {
        this.diffResult = diff.diffResult;
      },
      error: () => {
        this.errorMessage = 'Could not load the diff.';
      }
    });
  }

  addComment(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.selectedFile || !this.commentContent.trim()) {
      return;
    }

    this.commentService
      .addComment({
        projectId: this.project.projectId,
        fileId: this.selectedFile.fileId,
        authorId: currentUser.userId,
        content: this.commentContent.trim(),
        lineNumber: this.commentLineNumber,
        columnNumber: null,
        parentCommentId: null,
        snapshotId: this.snapshots[0]?.snapshotId || null
      })
      .subscribe({
        next: (comment) => {
          this.comments = this.sortComments([comment, ...this.comments]);
          this.commentContent = '';
          this.commentLineNumber = null;
        },
        error: () => {
          this.errorMessage = 'Could not add the comment.';
        }
      });
  }

  replyToComment(comment: CommentItem): void {
    const currentUser = this.authService.currentUser();
    const content = this.replyContentByCommentId[comment.commentId]?.trim();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.selectedFile || !content) {
      return;
    }

    this.commentService
      .replyToComment(comment.commentId, {
        projectId: this.project.projectId,
        fileId: this.selectedFile.fileId,
        authorId: currentUser.userId,
        content,
        lineNumber: comment.lineNumber,
        columnNumber: null,
        parentCommentId: comment.commentId,
        snapshotId: comment.snapshotId
      })
      .subscribe({
        next: (reply) => {
          this.comments = this.sortComments([reply, ...this.comments]);
          this.replyContentByCommentId[comment.commentId] = '';
        },
        error: () => {
          this.errorMessage = 'Could not add the reply.';
        }
      });
  }

  toggleResolve(comment: CommentItem): void {
    if (!this.ensureCanModifyWorkspace()) {
      return;
    }

    const request$ = comment.resolved
      ? this.commentService.unresolveComment(comment.commentId)
      : this.commentService.resolveComment(comment.commentId);

    request$.subscribe({
      next: (updatedComment) => {
        this.comments = this.comments.map((item) =>
          item.commentId === updatedComment.commentId ? updatedComment : item
        );
      },
      error: () => {
        this.errorMessage = 'Could not update the comment state.';
      }
    });
  }

  createSession(): void {
    const currentUser = this.authService.currentUser();
    if (!this.ensureCanModifyWorkspace() || !currentUser || !this.project || !this.selectedFile) {
      return;
    }

    this.collabService
      .createSession({
        projectId: this.project.projectId,
        fileId: this.selectedFile.fileId,
        ownerId: currentUser.userId,
        language: this.selectedFile.language || this.project.language,
        maxParticipants: this.maxParticipants,
        passwordProtected: this.passwordProtected,
        sessionPassword: this.passwordProtected ? this.sessionPassword : null
      })
      .subscribe({
        next: (session) => {
          this.sessions = this.sortSessions([session, ...this.sessions]);
          this.loadParticipants(session.sessionId);
          this.connectRealtime(session.sessionId);
        },
        error: () => {
          this.errorMessage = 'Could not create the collaboration session.';
        }
      });
  }

  joinSession(sessionId: string): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    this.collabService.joinSession(sessionId, currentUser.userId, 'EDITOR', this.sessionPassword).subscribe({
      next: (participant) => {
        this.participants = this.upsertParticipant(participant);
        this.loadParticipants(sessionId);
        this.connectRealtime(sessionId);
        this.clearLinkedSessionState(sessionId);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || error?.error || 'Could not join the collaboration session.';
        this.clearLinkedSessionState(sessionId);
      }
    });
  }

  updateCursor(): void {
    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    if (!currentUser || !session || !this.hasJoinedActiveSession || session.fileId !== this.selectedFile?.fileId) {
      this.refreshEditorCursorIndicators();
      return;
    }

    const cursor = this.getEditorCursorLocation();
    this.updateLocalParticipantCursor(cursor.line, cursor.col);

    if (this.realtimeConnected) {
      this.collabRealtimeService.send({
        type: 'CURSOR_UPDATE',
        sessionId: session.sessionId,
        userId: currentUser.userId,
        fileId: this.selectedFile?.fileId,
        cursorLine: cursor.line,
        cursorCol: cursor.col
      });
      return;
    }

    this.collabService.updateCursor(session.sessionId, currentUser.userId, cursor.line, cursor.col).subscribe({
      next: (participant) => {
        this.participants = this.upsertParticipant(participant);
        this.refreshEditorCursorIndicators();
      },
      error: () => {
        this.errorMessage = 'Could not update cursor position.';
      }
    });
  }

  onEditorContentChange(content: string): void {
    if (this.applyingRemoteContent) {
      return;
    }

    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    if (
      !currentUser ||
      !session ||
      !this.hasJoinedActiveSession ||
      !this.selectedFile ||
      this.selectedFile.folder ||
      session.fileId !== this.selectedFile.fileId ||
      !this.realtimeConnected
    ) {
      return;
    }

    const cursor = this.getEditorCursorLocation();
    this.updateLocalParticipantCursor(cursor.line, cursor.col);

    this.collabRealtimeService.send({
      type: 'CONTENT_CHANGE',
      sessionId: session.sessionId,
      userId: currentUser.userId,
      fileId: this.selectedFile.fileId,
      content,
      cursorLine: cursor.line,
      cursorCol: cursor.col
    });
  }

  handleEditorKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || this.isEditorReadOnly) {
      return;
    }

    const textarea = this.codeEditor?.nativeElement;
    if (!textarea) {
      return;
    }

    const cursorStart = textarea.selectionStart;
    const cursorEnd = textarea.selectionEnd;
    const value = textarea.value;
    const lineStart = value.lastIndexOf('\n', cursorStart - 1) + 1;
    const beforeCursorOnLine = value.slice(lineStart, cursorStart);
    const afterCursorOnLine = value.slice(cursorStart, value.indexOf('\n', cursorStart) === -1 ? value.length : value.indexOf('\n', cursorStart));
    const baseIndent = beforeCursorOnLine.match(/^\s*/)?.[0] || '';
    const indentUnit = this.getEditorIndentUnit(value);
    const nextIndent = baseIndent + (this.shouldIncreaseIndent(beforeCursorOnLine) ? indentUnit : '');
    const shouldSplitClosingBlock = this.shouldSplitClosingBlock(beforeCursorOnLine, afterCursorOnLine);
    const insertion = shouldSplitClosingBlock ? `\n${nextIndent}\n${baseIndent}` : `\n${nextIndent}`;

    event.preventDefault();

    const nextContent = value.slice(0, cursorStart) + insertion + value.slice(cursorEnd);
    const nextCursorPosition = cursorStart + 1 + nextIndent.length;

    this.editorContent = nextContent;
    textarea.value = nextContent;
    textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
    this.onEditorContentChange(nextContent);
    this.updateCursor();
  }

  refreshEditorCursorIndicators(): void {
    const textarea = this.codeEditor?.nativeElement;
    const session = this.activeSession;
    if (!textarea || !session || !this.selectedFile || this.selectedFile.folder || session.fileId !== this.selectedFile.fileId) {
      this.editorCursorIndicators = [];
      return;
    }

    const styles = window.getComputedStyle(textarea);
    const fontSize = this.parseCssPixels(styles.fontSize, 14);
    const lineHeight = this.parseCssPixels(styles.lineHeight, fontSize * 1.55);
    const paddingTop = this.parseCssPixels(styles.paddingTop, 0);
    const paddingRight = this.parseCssPixels(styles.paddingRight, 0);
    const paddingBottom = this.parseCssPixels(styles.paddingBottom, 0);
    const paddingLeft = this.parseCssPixels(styles.paddingLeft, 0);
    const charWidth = this.measureEditorCharacterWidth(styles, fontSize);

    this.editorCursorIndicators = this.getEditorCursorParticipants(session).flatMap((participant) => {
      const line = Math.max(1, participant.cursorLine || 1);
      const col = Math.max(1, participant.cursorCol || 1);
      const top = paddingTop + (line - 1) * lineHeight - textarea.scrollTop;
      const rawLeft = paddingLeft + (col - 1) * charWidth - textarea.scrollLeft;

      if (top < paddingTop - lineHeight || top > textarea.clientHeight - paddingBottom) {
        return [];
      }

      return [{
        userId: participant.userId,
        label: this.getParticipantDisplayName(participant),
        color: participant.color || '#22c55e',
        left: Math.min(Math.max(rawLeft, paddingLeft), Math.max(paddingLeft, textarea.clientWidth - paddingRight)),
        top: Math.max(0, top),
        height: lineHeight
      }];
    });
  }

  clearLocalEditorCursor(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    this.activeEditorCursorUserIds.delete(currentUser.userId);
    this.refreshEditorCursorIndicators();

    const session = this.activeSession;
    if (!session || !this.selectedFile || session.fileId !== this.selectedFile.fileId || !this.realtimeConnected) {
      return;
    }

    this.collabRealtimeService.send({
      type: 'CURSOR_UPDATE',
      sessionId: session.sessionId,
      userId: currentUser.userId,
      fileId: this.selectedFile.fileId,
      cursorLine: null,
      cursorCol: null
    });
  }

  endSession(sessionId: string): void {
    if (!this.isSessionHost) {
      this.errorMessage = 'Only the session host can end the collaboration session.';
      return;
    }

    this.collabService.endSession(sessionId).subscribe({
      next: () => {
        this.sessions = this.sessions.map((session) =>
          session.sessionId === sessionId ? { ...session, status: 'ENDED' } : session
        );
        if (!this.activeSession) {
          this.collabRealtimeService.disconnect();
          this.resetEditorCursorPresence();
        }
      },
      error: () => {
        this.errorMessage = 'Could not end the session.';
      }
    });
  }

  sendInvite(): void {
    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    const recipientInput = this.inviteRecipient.trim();
    if (!currentUser || !session || !recipientInput) {
      return;
    }

    const recipientId = this.resolveInviteRecipientId(recipientInput);
    if (!recipientId) {
      this.errorMessage = 'Enter a valid project username, name, email, or user id.';
      return;
    }

    if (recipientId === currentUser.userId) {
      this.errorMessage = 'You cannot invite yourself to the session.';
      return;
    }

    this.collabService
      .sendSessionInvite(session.sessionId, {
        recipientId,
        actorId: currentUser.userId,
        title: `Session invite: ${this.project?.projectName || 'CodeSync'}`,
        message: `Join session ${session.sessionId} for ${this.selectedFile?.name || 'file'}.`,
      })
      .subscribe({
        next: () => {
          this.inviteRecipient = '';
          this.saveMessage = 'Invite notification queued.';
        },
        error: () => {
          this.errorMessage = 'Could not send the invite notification.';
        }
      });
  }

  copySessionLink(session: CollabSession): void {
    const link = `${window.location.origin}/projects/${session.projectId}?session=${session.sessionId}`;
    navigator.clipboard?.writeText(link);
    this.saveMessage = 'Session share link copied.';
  }

  kickParticipant(participant: Participant): void {
    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    if (!currentUser || !session || !this.isSessionHost || participant.userId === currentUser.userId) {
      return;
    }

    this.collabService.kickParticipant(session.sessionId, currentUser.userId, participant.userId).subscribe({
      next: () => {
        this.participants = this.participants.filter((item) => item.userId !== participant.userId);
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || error?.error || 'Could not remove the participant.';
      }
    });
  }

  deleteProject(): void {
    if (!this.project || !this.isOwner) {
      return;
    }

    const projectName = this.project.projectName;
    const confirmed = window.confirm(`Delete "${projectName}"? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    this.projectService.deleteProject(this.project.projectId).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.errorMessage = 'Could not delete the project right now.';
      }
    });
  }

  private loadWorkspace(projectId: number): void {
    this.stopWorkspaceLiveRefresh();
    this.stopFileContextLiveRefresh();
    this.collabRealtimeService.disconnect();
    this.loading = true;
    this.errorMessage = '';
    this.saveMessage = '';
    this.project = null;
    this.files = [];
    this.filteredFiles = [];
    this.selectedFile = null;
    this.executions = [];
    this.projectExecutions = [];
    this.selectedFileExecutionCount = 0;
    this.snapshots = [];
    this.comments = [];
    this.sessions = [];
    this.participants = [];
    this.diffResult = '';
    this.linkedSessionFileId = null;
    this.joiningLinkedSessionId = null;
    this.resetEditorCursorPresence();

    this.projectService.getProjectById(projectId).subscribe({
      next: (project) => {
        if (this.isReadOnly && project.visibility !== 'PUBLIC') {
          this.project = null;
          this.loading = false;
          this.errorMessage = 'Guests can only view public projects. Please log in to access this private workspace.';
          return;
        }

        this.project = project;
        this.startWorkspaceLiveRefresh(projectId);

        this.fileService.getProjectFiles(projectId).subscribe({
          next: (files) => {
            this.files = this.sortFiles(files);
            this.filteredFiles = this.sortFiles(files);
            this.selectedFile = this.filteredFiles.find((file) => !file.folder) || null;
            this.editorContent = this.selectedFile?.content || '';
            const selectedFromLink = this.selectLinkedSessionFile();
            if (this.selectedFile && !selectedFromLink) {
              this.loadFileContext(this.selectedFile.fileId);
            }
            this.loading = false;
          },
          error: () => {
            this.loading = false;
          }
        });

        this.executionService.getExecutionsByProject(projectId).subscribe({
          next: (executions) => {
            this.applyProjectExecutions(executions);
          },
          error: () => {
            this.executions = [];
            this.projectExecutions = [];
            this.selectedFileExecutionCount = 0;
          }
        });

        this.collabService.getSessionsByProject(projectId).subscribe({
          next: (sessions) => {
            this.sessions = this.sortSessions(sessions);
            if (this.activeSession) {
              this.loadParticipants(this.activeSession.sessionId, true);
            }
            this.tryJoinLinkedSession();
          },
          error: () => {
            this.sessions = [];
          }
        });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Project could not be loaded. Check the project service and try again.';
      }
    });
  }

  private loadFileContext(fileId: number): void {
    this.startFileContextLiveRefresh(fileId);
  }

  private startWorkspaceLiveRefresh(projectId: number): void {
    this.stopWorkspaceLiveRefresh();

    this.workspaceLiveSubscriptions.add(
      this.liveRefreshService.poll(() => this.projectService.getProjectById(projectId)).subscribe((result) => {
        if (!result.ok) {
          return;
        }

        if (this.isReadOnly && result.data.visibility !== 'PUBLIC') {
          this.project = null;
          this.loading = false;
          this.errorMessage = 'Guests can only view public projects. Please log in to access this private workspace.';
          this.stopWorkspaceLiveRefresh();
          this.stopFileContextLiveRefresh();
          return;
        }

        this.project = result.data;
      })
    );

    this.workspaceLiveSubscriptions.add(
      this.liveRefreshService.poll(() => this.fileService.getProjectFiles(projectId), 4000).subscribe((result) => {
        if (result.ok) {
          this.applyLiveFiles(result.data);
          this.loading = false;
        }
      })
    );

    this.workspaceLiveSubscriptions.add(
      this.liveRefreshService
        .poll(() => this.executionService.getExecutionsByProject(projectId), 4000)
        .subscribe((result) => {
          if (result.ok) {
            this.applyProjectExecutions(result.data);
          }
        })
    );

    this.workspaceLiveSubscriptions.add(
      this.liveRefreshService.poll(() => this.collabService.getSessionsByProject(projectId)).subscribe((result) => {
        if (!result.ok) {
          return;
        }

        const activeSessionId = this.activeSession?.sessionId || null;
        this.sessions = this.sortSessions(result.data);

        if (this.activeSession) {
          this.loadParticipants(this.activeSession.sessionId, true);
          this.tryJoinLinkedSession();
          return;
        }

        if (activeSessionId) {
          this.collabRealtimeService.disconnect();
          this.resetEditorCursorPresence();
        }
      })
    );
  }

  private startFileContextLiveRefresh(fileId: number): void {
    this.stopFileContextLiveRefresh();
    let shouldForceContentSync = true;
    const initialEditorContent = this.editorContent;

    this.fileContextLiveSubscriptions.add(
      this.liveRefreshService.poll(() => this.fileService.getFileContent(fileId), 3000).subscribe((result) => {
        if (this.selectedFile?.fileId !== fileId) {
          return;
        }

        if (result.ok) {
          this.applySelectedFileContent(fileId, result.data, shouldForceContentSync && this.editorContent === initialEditorContent);
          shouldForceContentSync = false;
          return;
        }

        if (!this.editorContent) {
          this.editorContent = this.selectedFile?.content || '';
        }
      })
    );

    this.fileContextLiveSubscriptions.add(
      this.liveRefreshService.poll(() => this.versionService.getFileHistory(fileId), 4000).subscribe((result) => {
        if (this.selectedFile?.fileId === fileId && result.ok) {
          this.applySnapshots(result.data);
        }
      })
    );

    this.fileContextLiveSubscriptions.add(
      this.liveRefreshService.poll(() => this.commentService.getCommentsByFile(fileId), 4000).subscribe((result) => {
        if (this.selectedFile?.fileId === fileId && result.ok) {
          this.comments = this.sortComments(result.data);
        }
      })
    );
  }

  private stopWorkspaceLiveRefresh(): void {
    this.workspaceLiveSubscriptions.unsubscribe();
    this.workspaceLiveSubscriptions = new Subscription();
  }

  private stopFileContextLiveRefresh(): void {
    this.fileContextLiveSubscriptions.unsubscribe();
    this.fileContextLiveSubscriptions = new Subscription();
  }

  private applyLiveFiles(files: ProjectFile[]): void {
    const sortedFiles = this.sortFiles(files);
    const selectedFileId = this.selectedFile?.fileId || null;
    const hadLocalEditorChanges = this.hasLocalEditorChanges();

    this.files = sortedFiles;

    if (selectedFileId) {
      const refreshedSelection = sortedFiles.find((file) => file.fileId === selectedFileId) || null;

      if (refreshedSelection) {
        this.selectedFile = refreshedSelection;
        if (!refreshedSelection.folder && !hadLocalEditorChanges && refreshedSelection.content !== this.editorContent) {
          this.editorContent = refreshedSelection.content || '';
        }
      } else {
        this.selectedFile = sortedFiles.find((file) => !file.folder) || null;
        this.editorContent = this.selectedFile?.content || '';
        this.updateSelectedFileExecutionCount();
        this.applyVisibleExecutions();
        this.snapshots = [];
        this.comments = [];

        if (this.selectedFile) {
          this.loadFileContext(this.selectedFile.fileId);
        } else {
          this.stopFileContextLiveRefresh();
        }
      }
    } else {
      this.selectedFile = sortedFiles.find((file) => !file.folder) || null;
      this.editorContent = this.selectedFile?.content || '';
      this.updateSelectedFileExecutionCount();
      this.applyVisibleExecutions();

      if (this.selectedFile) {
        this.loadFileContext(this.selectedFile.fileId);
      } else {
        this.stopFileContextLiveRefresh();
        this.snapshots = [];
        this.comments = [];
      }
    }

    this.applyLocalFileFilter();
  }

  private applyProjectExecutions(executions: ExecutionResponse[]): void {
    this.projectExecutions = this.mergeExecutions(this.projectExecutions, executions);
    this.applyVisibleExecutions();
    this.updateSelectedFileExecutionCount();
    const currentUser = this.authService.currentUser();
    if (currentUser) {
      this.hasExecutionPass = this.paymentService.hasExecutionPass(currentUser.userId);
    }
  }

  private applyVisibleExecutions(): void {
    const selectedFileId = this.selectedFile?.fileId;
    this.executions = selectedFileId
      ? this.sortExecutions(this.projectExecutions.filter((execution) => execution.fileId === selectedFileId))
      : [];
  }

  private mergeExecutions(
    existingExecutions: ExecutionResponse[],
    incomingExecutions: ExecutionResponse[]
  ): ExecutionResponse[] {
    const merged = new Map<string, ExecutionResponse>();

    [...existingExecutions, ...incomingExecutions].forEach((execution) => {
      const current = merged.get(execution.jobId);
      merged.set(execution.jobId, this.pickMoreCompleteExecution(current, execution));
    });

    return this.sortExecutions([...merged.values()]);
  }

  private pickMoreCompleteExecution(
    current: ExecutionResponse | undefined,
    candidate: ExecutionResponse
  ): ExecutionResponse {
    if (!current) {
      return candidate;
    }

    const currentScore = this.executionCompletenessScore(current);
    const candidateScore = this.executionCompletenessScore(candidate);

    if (candidateScore !== currentScore) {
      return candidateScore > currentScore ? candidate : current;
    }

    return this.executionTimestamp(candidate.completedAt || candidate.createdAt) >=
      this.executionTimestamp(current.completedAt || current.createdAt)
      ? candidate
      : current;
  }

  private executionCompletenessScore(execution: ExecutionResponse): number {
    const status = execution.status.toUpperCase();
    const terminalScore = ['COMPLETED', 'FAILED', 'TIMED_OUT', 'CANCELLED'].includes(status)
      ? 8
      : status === 'RUNNING'
        ? 4
        : status === 'QUEUED'
          ? 2
          : 0;

    return (
      terminalScore +
      (execution.stdout ? 2 : 0) +
      (execution.stderr ? 2 : 0) +
      (execution.completedAt ? 1 : 0) +
      (execution.exitCode !== null && execution.exitCode !== undefined ? 1 : 0)
    );
  }

  private executionTimestamp(value: string | null): number {
    if (!value) {
      return 0;
    }

    const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
    const timestamp = new Date(normalizedValue).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  private applySnapshots(snapshots: Snapshot[]): void {
    this.snapshots = this.sortSnapshots(snapshots);
    this.loadSnapshotAuthorProfiles(this.snapshots);
  }

  private loadSnapshotAuthorProfiles(snapshots: Snapshot[]): void {
    this.loadParticipantProfiles(snapshots.map((snapshot) => snapshot.authorId), true);
  }

  private resetEditorCursorPresence(): void {
    this.currentCursorLine = 1;
    this.currentCursorCol = 1;
    this.activeEditorCursorUserIds.clear();
    this.editorCursorIndicators = [];
  }

  private getEditorIndentUnit(content: string): string {
    const indentedLines = content
      .split('\n')
      .map((line) => line.match(/^\s+/)?.[0] || '')
      .filter((indent) => indent.length);

    if (indentedLines.some((indent) => indent.includes('\t') && !indent.includes(' '))) {
      return '\t';
    }

    const spaceIndents = indentedLines
      .filter((indent) => !indent.includes('\t'))
      .map((indent) => indent.length)
      .filter((length) => length > 0)
      .sort((left, right) => left - right);
    const detectedIndent = this.detectSpaceIndentUnit(spaceIndents);
    if (detectedIndent) {
      return ' '.repeat(detectedIndent);
    }

    return this.usesTwoSpaceIndent() ? '  ' : '    ';
  }

  private detectSpaceIndentUnit(indentLengths: number[]): number | null {
    const uniqueLengths = [...new Set(indentLengths)];
    let detectedIndent = uniqueLengths[0] || 0;

    for (let index = 1; index < uniqueLengths.length; index += 1) {
      detectedIndent = this.greatestCommonDivisor(detectedIndent, uniqueLengths[index]);
    }

    return detectedIndent >= 2 && detectedIndent <= 8 ? detectedIndent : null;
  }

  private greatestCommonDivisor(left: number, right: number): number {
    let a = Math.abs(left);
    let b = Math.abs(right);
    while (b) {
      const remainder = a % b;
      a = b;
      b = remainder;
    }
    return a;
  }

  private shouldIncreaseIndent(beforeCursorOnLine: string): boolean {
    const line = beforeCursorOnLine.trimEnd();
    if (!line) {
      return false;
    }

    return /[\{\[\(]$/.test(line) || (this.usesColonBlocks() && /:\s*(#.*)?$/.test(line));
  }

  private shouldSplitClosingBlock(beforeCursorOnLine: string, afterCursorOnLine: string): boolean {
    const closingCharacterByOpeningCharacter: Record<string, string> = {
      '{': '}',
      '[': ']',
      '(': ')'
    };
    const openingCharacter = beforeCursorOnLine.trimEnd().slice(-1);
    const closingCharacter = closingCharacterByOpeningCharacter[openingCharacter];

    return !!closingCharacter && afterCursorOnLine.trimStart().startsWith(closingCharacter);
  }

  private usesColonBlocks(): boolean {
    const language = this.getEditorLanguage();
    return ['python', 'ruby', 'yaml', 'yml'].some((item) => language.includes(item));
  }

  private usesTwoSpaceIndent(): boolean {
    const language = this.getEditorLanguage();
    return ['javascript', 'typescript', 'html', 'css', 'json', 'xml', 'yaml', 'yml'].some((item) =>
      language.includes(item)
    );
  }

  private getEditorLanguage(): string {
    return (this.selectedFile?.language || this.project?.language || '').toLowerCase();
  }

  private getEditorCursorLocation(): { line: number; col: number } {
    const editorValue = this.codeEditor?.nativeElement.value ?? this.editorContent;
    const cursorIndex = this.codeEditor?.nativeElement.selectionStart ?? editorValue.length;
    const beforeCursor = editorValue.slice(0, cursorIndex);
    const lines = beforeCursor.split('\n');
    const currentLine = lines[lines.length - 1] || '';

    return {
      line: lines.length,
      col: currentLine.length + 1
    };
  }

  private updateLocalParticipantCursor(line: number, col: number): void {
    this.currentCursorLine = line;
    this.currentCursorCol = col;

    const currentUser = this.authService.currentUser();
    const session = this.activeSession;
    if (!currentUser || !session || !this.hasJoinedActiveSession) {
      this.refreshEditorCursorIndicators();
      return;
    }

    this.activeEditorCursorUserIds.add(currentUser.userId);

    const existing = this.participants.find((participant) =>
      participant.sessionId === session.sessionId && participant.userId === currentUser.userId
    );

    this.participants = this.upsertParticipant({
      participantId: existing?.participantId ?? currentUser.userId,
      sessionId: session.sessionId,
      userId: currentUser.userId,
      username: existing?.username || currentUser.fullName,
      fullName: existing?.fullName || currentUser.fullName,
      email: existing?.email || currentUser.email,
      role: existing?.role || (session.ownerId === currentUser.userId ? 'HOST' : 'EDITOR'),
      joinedAt: existing?.joinedAt || new Date().toISOString(),
      leftAt: null,
      cursorLine: line,
      cursorCol: col,
      color: existing?.color || (session.ownerId === currentUser.userId ? '#FF5733' : '#33FF57')
    });
    this.refreshEditorCursorIndicators();
  }

  private getEditorCursorParticipants(session: CollabSession): Participant[] {
    const currentUser = this.authService.currentUser();
    const participantsByUserId = new Map<number, Participant>();

    this.participants
      .filter((participant) =>
        participant.sessionId === session.sessionId &&
        !participant.leftAt &&
        this.activeEditorCursorUserIds.has(participant.userId)
      )
      .forEach((participant) => participantsByUserId.set(participant.userId, participant));

    if (currentUser && this.hasJoinedActiveSession && this.activeEditorCursorUserIds.has(currentUser.userId)) {
      const existing = participantsByUserId.get(currentUser.userId);
      participantsByUserId.set(currentUser.userId, {
        participantId: existing?.participantId ?? currentUser.userId,
        sessionId: session.sessionId,
        userId: currentUser.userId,
        username: existing?.username || currentUser.fullName,
        fullName: existing?.fullName || currentUser.fullName,
        email: existing?.email || currentUser.email,
        role: existing?.role || (session.ownerId === currentUser.userId ? 'HOST' : 'EDITOR'),
        joinedAt: existing?.joinedAt || new Date().toISOString(),
        leftAt: null,
        cursorLine: this.currentCursorLine,
        cursorCol: this.currentCursorCol,
        color: existing?.color || (session.ownerId === currentUser.userId ? '#FF5733' : '#33FF57')
      });
    }

    return [...participantsByUserId.values()];
  }

  private parseCssPixels(value: string, fallback: number): number {
    const parsedValue = Number.parseFloat(value);
    return Number.isFinite(parsedValue) ? parsedValue : fallback;
  }

  private measureEditorCharacterWidth(styles: CSSStyleDeclaration, fallbackFontSize: number): number {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      return fallbackFontSize * 0.62;
    }

    context.font = `${styles.fontWeight} ${styles.fontSize} ${styles.fontFamily}`;
    return context.measureText('M').width || fallbackFontSize * 0.62;
  }

  private resolveInviteRecipientId(recipient: string): number | null {
    if (/^\d+$/.test(recipient)) {
      return Number(recipient);
    }

    const lookupValue = this.normalizeInviteLookupValue(recipient);
    const match = this.getInviteRecipientCandidates().find((candidate) =>
      !!candidate.userId &&
      this.getInviteCandidateLabels(candidate).some((label) =>
        this.normalizeInviteLookupValue(label) === lookupValue
      )
    );

    return match?.userId || null;
  }

  private getInviteRecipientCandidates(): InviteRecipientCandidate[] {
    const candidates: InviteRecipientCandidate[] = [];

    if (this.project) {
      candidates.push({
        userId: this.project.ownerId,
        username: this.project.ownerUsername || this.project.owner?.username,
        fullName: this.project.ownerFullName || this.project.owner?.fullName,
        email: this.project.owner?.email
      });

      this.project.contributors?.forEach((contributor) => candidates.push(contributor));
      this.project.contributorIds?.forEach((userId, index) => {
        candidates.push({
          userId,
          username: this.project?.contributorUsernames?.[index]
        });
      });
    }

    this.participants.forEach((participant) => candidates.push(participant));
    Object.values(this.participantProfiles).forEach((profile) => candidates.push(profile));

    return candidates.filter((candidate) => Number.isFinite(candidate.userId));
  }

  private getInviteCandidateLabels(candidate: InviteRecipientCandidate): string[] {
    return [candidate.username, candidate.fullName, candidate.email].filter(
      (label): label is string => !!label?.trim()
    );
  }

  private normalizeInviteLookupValue(value: string): string {
    return value.trim().replace(/^@/, '').toLowerCase();
  }

  private updateSelectedFileExecutionCount(): void {
    const currentUser = this.authService.currentUser();
    const fileId = this.selectedFile?.fileId;

    if (!currentUser || !fileId) {
      this.selectedFileExecutionCount = 0;
      return;
    }

    this.selectedFileExecutionCount = this.projectExecutions.filter(
      (execution) => execution.userId === currentUser.userId && execution.fileId === fileId
    ).length;
  }

  private applySelectedFileContent(fileId: number, content: string, forceEditorSync = false): void {
    const isSelectedFile = this.selectedFile?.fileId === fileId;
    const hadLocalEditorChanges = this.hasLocalEditorChanges();

    this.files = this.files.map((file) => (file.fileId === fileId ? { ...file, content } : file));
    this.applyLocalFileFilter();

    if (!isSelectedFile || !this.selectedFile) {
      return;
    }

    this.selectedFile = { ...this.selectedFile, content };
    if (!this.selectedFile.folder && (forceEditorSync || !hadLocalEditorChanges || this.editorContent === content)) {
      this.editorContent = content;
    }
  }

  private applyLocalFileFilter(): void {
    const keyword = this.projectSearch.trim().toLowerCase();

    if (!keyword) {
      this.filteredFiles = this.sortFiles(this.files);
      return;
    }

    this.filteredFiles = this.sortFiles(
      this.files.filter((file) =>
        file.name.toLowerCase().includes(keyword) ||
        file.path.toLowerCase().includes(keyword) ||
        file.content.toLowerCase().includes(keyword)
      )
    );
  }

  private hasLocalEditorChanges(): boolean {
    return !!this.selectedFile && !this.selectedFile.folder && this.editorContent !== (this.selectedFile.content || '');
  }

  private tryJoinLinkedSession(): void {
    const sessionId = this.linkedSessionId;
    const currentUser = this.authService.currentUser();
    if (!sessionId || !currentUser || this.joiningLinkedSessionId === sessionId) {
      return;
    }

    const session = this.sessions.find((item) => item.sessionId === sessionId);
    if (!session) {
      return;
    }

    this.selectSessionFile(session);

    if (session.status !== 'ACTIVE') {
      this.errorMessage = 'This collaboration session link is no longer active.';
      this.clearLinkedSessionState(sessionId);
      return;
    }

    if (this.isCurrentUserInSession(session)) {
      this.connectRealtime(sessionId);
      this.clearLinkedSessionState(sessionId);
      return;
    }

    this.joiningLinkedSessionId = sessionId;
    this.joinSession(sessionId);
  }

  private selectSessionFile(session: CollabSession): void {
    this.linkedSessionFileId = session.fileId;
    this.selectLinkedSessionFile();
  }

  private selectLinkedSessionFile(): boolean {
    const fileId = this.linkedSessionFileId;
    if (!fileId) {
      return false;
    }

    const sessionFile = this.files.find((file) => file.fileId === fileId && !file.folder);
    if (!sessionFile || this.selectedFile?.fileId === sessionFile.fileId) {
      return false;
    }

    this.selectFile(sessionFile);
    return true;
  }

  private isCurrentUserInSession(session: CollabSession): boolean {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return false;
    }

    return (
      session.ownerId === currentUser.userId ||
      this.participants.some((participant) =>
        participant.sessionId === session.sessionId &&
        participant.userId === currentUser.userId &&
        !participant.leftAt
      )
    );
  }

  private clearLinkedSessionState(sessionId: string): void {
    if (this.linkedSessionId === sessionId) {
      this.linkedSessionId = null;
    }

    if (this.joiningLinkedSessionId === sessionId) {
      this.joiningLinkedSessionId = null;
    }
  }

  private loadParticipants(sessionId: string, connectIfParticipant = false): void {
    this.collabService.getParticipants(sessionId).subscribe({
      next: (participants) => {
        this.participants = this.mergeParticipantsWithKnownNames(participants);
        this.loadParticipantProfiles(participants.map((participant) => participant.userId));
        this.refreshEditorCursorIndicators();
        const currentUser = this.authService.currentUser();
        if (connectIfParticipant && currentUser && this.activeSession?.sessionId === sessionId) {
          this.connectRealtime(sessionId);
        }
      },
      error: () => {
        this.participants = [];
      }
    });
  }

  private connectRealtime(sessionId: string): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) {
      return;
    }

    this.collabRealtimeService.connect(sessionId, currentUser.userId);
  }

  private ensureCanModifyWorkspace(): boolean {
    if (this.canModifyWorkspace) {
      return true;
    }

    this.errorMessage = this.mustJoinActiveSession
      ? 'Join the active collaboration session before modifying this workspace.'
      : 'Please log in before modifying this workspace.';
    return false;
  }

  private handleRealtimeMessage(message: CollabRealtimeMessage): void {
    if (message.clientId === this.collabRealtimeService.clientId) {
      return;
    }

    if (message.type === 'CONTENT_CHANGE' && message.fileId === this.selectedFile?.fileId && message.content !== undefined) {
      if (!this.isJoinedSessionUser(message.sessionId, message.userId)) {
        return;
      }

      this.applyRealtimeCursor(message);
      this.applyingRemoteContent = true;
      this.editorContent = message.content || '';
      queueMicrotask(() => {
        this.applyingRemoteContent = false;
        this.refreshEditorCursorIndicators();
      });
      return;
    }

    if (message.type === 'CURSOR_UPDATE' && message.userId) {
      this.applyRealtimeCursor(message);
      return;
    }

    if ((message.type === 'CURSOR_UPDATE' || message.type === 'USER_CONNECTED') && message.participant) {
      const participant = this.applyRealtimeName(message.participant, message.content);
      this.participants = this.upsertParticipant(participant);
      this.loadParticipantProfiles([participant.userId]);
      this.refreshEditorCursorIndicators();
      if (message.type === 'USER_CONNECTED') {
        this.announceCurrentCursor(message.sessionId);
        this.loadParticipants(message.sessionId);
      }
      return;
    }

    if (message.type === 'PARTICIPANT_NAME') {
      const participant = this.participantFromRealtimeName(message);
      if (participant) {
        this.participants = this.upsertParticipant(participant);
        this.refreshEditorCursorIndicators();
      }
      return;
    }

    if (message.type === 'USER_CONNECTED') {
      const participant = this.participantFromRealtimeName(message);
      if (participant) {
        this.participants = this.upsertParticipant(participant);
        this.refreshEditorCursorIndicators();
      }

      if (!message.content?.trim()) {
        this.announceCurrentParticipant(message.sessionId);
        this.announceCurrentCursor(message.sessionId);
      }

      this.loadParticipants(message.sessionId);
      return;
    }

    if (message.type === 'USER_DISCONNECTED') {
      this.loadParticipants(message.sessionId);
    }
  }

  private announceCurrentParticipant(sessionId = this.activeSession?.sessionId || ''): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser || !sessionId || !this.realtimeConnected || !this.hasJoinedActiveSession) {
      return;
    }

    const existing = this.participants.find((participant) =>
      participant.sessionId === sessionId && participant.userId === currentUser.userId
    );
    const session = this.sessions.find((item) => item.sessionId === sessionId);
    const participant: Participant = {
      participantId: existing?.participantId ?? currentUser.userId,
      sessionId,
      userId: currentUser.userId,
      username: currentUser.fullName,
      fullName: currentUser.fullName,
      email: currentUser.email,
      role: existing?.role || (session?.ownerId === currentUser.userId ? 'HOST' : 'EDITOR'),
      joinedAt: existing?.joinedAt || new Date().toISOString(),
      leftAt: null,
      cursorLine: existing?.cursorLine ?? 1,
      cursorCol: existing?.cursorCol ?? 1,
      color: existing?.color || (session?.ownerId === currentUser.userId ? '#FF5733' : '#33FF57')
    };

    this.participants = this.upsertParticipant(participant);
    this.collabRealtimeService.send({
      type: 'PARTICIPANT_NAME',
      sessionId,
      userId: currentUser.userId,
      content: currentUser.fullName || currentUser.email
    });
  }

  private announceCurrentCursor(sessionId = this.activeSession?.sessionId || ''): void {
    const currentUser = this.authService.currentUser();
    if (
      !currentUser ||
      !sessionId ||
      !this.realtimeConnected ||
      !this.selectedFile ||
      this.selectedFile.folder ||
      this.activeSession?.fileId !== this.selectedFile.fileId ||
      !this.activeEditorCursorUserIds.has(currentUser.userId)
    ) {
      return;
    }

    this.collabRealtimeService.send({
      type: 'CURSOR_UPDATE',
      sessionId,
      userId: currentUser.userId,
      fileId: this.selectedFile.fileId,
      cursorLine: this.currentCursorLine,
      cursorCol: this.currentCursorCol
    });
  }

  private applyRealtimeCursor(message: CollabRealtimeMessage): void {
    if (
      !message.userId ||
      message.fileId !== this.selectedFile?.fileId ||
      message.cursorLine == null ||
      message.cursorCol == null
    ) {
      if (message.userId) {
        this.activeEditorCursorUserIds.delete(message.userId);
      }
      this.refreshEditorCursorIndicators();
      return;
    }

    const participant = this.participantFromRealtimeCursor(message);
    if (!participant) {
      return;
    }

    this.activeEditorCursorUserIds.add(participant.userId);
    this.participants = this.upsertParticipant(participant);
    this.loadParticipantProfiles([participant.userId]);
    this.refreshEditorCursorIndicators();
  }

  private participantFromRealtimeCursor(message: CollabRealtimeMessage): Participant | null {
    const userId = message.userId;
    if (!userId) {
      return null;
    }

    const existing = this.participants.find((participant) =>
      participant.sessionId === message.sessionId && participant.userId === userId
    );
    const session = this.sessions.find((item) => item.sessionId === message.sessionId);
    const participant = message.participant;

    return {
      participantId: participant?.participantId ?? existing?.participantId ?? userId,
      sessionId: message.sessionId,
      userId,
      username: participant?.username || existing?.username,
      fullName: participant?.fullName || existing?.fullName,
      email: participant?.email || existing?.email,
      role: participant?.role || existing?.role || (session?.ownerId === userId ? 'HOST' : 'EDITOR'),
      joinedAt: participant?.joinedAt || existing?.joinedAt || message.sentAt || new Date().toISOString(),
      leftAt: participant?.leftAt ?? existing?.leftAt ?? null,
      cursorLine: message.cursorLine ?? participant?.cursorLine ?? existing?.cursorLine ?? 1,
      cursorCol: message.cursorCol ?? participant?.cursorCol ?? existing?.cursorCol ?? 1,
      color: participant?.color || existing?.color || (session?.ownerId === userId ? '#FF5733' : '#33FF57')
    };
  }

  private applyRealtimeName(participant: Participant, displayName?: string | null): Participant {
    if (!displayName?.trim()) {
      return participant;
    }

    return {
      ...participant,
      username: participant.username || displayName.trim(),
      fullName: participant.fullName || displayName.trim()
    };
  }

  private participantFromRealtimeName(message: CollabRealtimeMessage): Participant | null {
    const userId = message.userId;
    const displayName = message.content?.trim();
    if (!userId || !displayName) {
      return null;
    }

    const existing = this.participants.find((participant) =>
      participant.sessionId === message.sessionId && participant.userId === userId
    );
    const session = this.sessions.find((item) => item.sessionId === message.sessionId);

    return {
      participantId: existing?.participantId ?? userId,
      sessionId: message.sessionId,
      userId,
      username: displayName,
      fullName: displayName,
      email: existing?.email,
      role: existing?.role || (session?.ownerId === userId ? 'HOST' : 'EDITOR'),
      joinedAt: existing?.joinedAt || message.sentAt || new Date().toISOString(),
      leftAt: existing?.leftAt ?? null,
      cursorLine: existing?.cursorLine ?? 1,
      cursorCol: existing?.cursorCol ?? 1,
      color: existing?.color || (session?.ownerId === userId ? '#FF5733' : '#33FF57')
    };
  }

  private upsertParticipant(participant: Participant): Participant[] {
    const mergedParticipant = this.mergeParticipantWithKnownName(participant, this.findExistingParticipant(participant));
    this.loadParticipantProfiles([mergedParticipant.userId]);

    const exists = this.participants.some((item) => item.participantId === mergedParticipant.participantId);
    if (!exists) {
      return [...this.participants, mergedParticipant];
    }

    return this.participants.map((item) =>
      item.participantId === mergedParticipant.participantId
        ? this.mergeParticipantWithKnownName(mergedParticipant, item)
        : item
    );
  }

  private mergeParticipantsWithKnownNames(participants: Participant[]): Participant[] {
    return participants.map((participant) =>
      this.mergeParticipantWithKnownName(participant, this.findExistingParticipant(participant))
    );
  }

  private mergeParticipantWithKnownName(participant: Participant, existing?: Participant): Participant {
    const profile = this.participantProfiles[participant.userId];

    return {
      ...participant,
      username: participant.username || existing?.username || profile?.username,
      fullName: participant.fullName || existing?.fullName || profile?.fullName,
      email: participant.email || existing?.email || profile?.email
    };
  }

  private findExistingParticipant(participant: Participant): Participant | undefined {
    return this.participants.find((item) =>
      item.participantId === participant.participantId ||
      (item.sessionId === participant.sessionId && item.userId === participant.userId)
    );
  }

  private isJoinedSessionUser(sessionId: string, userId: number | null): boolean {
    if (!userId) {
      return false;
    }

    const session = this.sessions.find((item) => item.sessionId === sessionId && item.status === 'ACTIVE');
    if (!session) {
      return false;
    }

    return (
      session.ownerId === userId ||
      this.participants.some((participant) =>
        participant.sessionId === sessionId &&
        participant.userId === userId &&
        !participant.leftAt
      )
    );
  }

  private loadParticipantProfiles(userIds: number[], includeCurrentUser = false): void {
    const idsToLoad = [...new Set(userIds)]
      .filter((userId) =>
        Number.isFinite(userId) &&
        !this.participantProfiles[userId] &&
        !this.loadingParticipantProfileIds.has(userId) &&
        (includeCurrentUser || !this.isCurrentUser(userId))
      );

    if (!idsToLoad.length) {
      return;
    }

    idsToLoad.forEach((userId) => this.loadingParticipantProfileIds.add(userId));

    this.authService.getUsersByIds(idsToLoad).subscribe({
      next: (profiles) => {
        this.participantProfiles = profiles.reduce(
          (profileMap, profile) => ({
            ...profileMap,
            [profile.userId]: profile
          }),
          this.participantProfiles
        );
        this.participants = this.mergeParticipantsWithKnownNames(this.participants);
        idsToLoad.forEach((userId) => this.loadingParticipantProfileIds.delete(userId));
      },
      error: () => {
        idsToLoad.forEach((userId) => this.loadingParticipantProfileIds.delete(userId));
      }
    });
  }

  private getUserDisplayName(userId: number, participant?: Participant): string {
    const currentUser = this.authService.currentUser();
    if (currentUser?.userId === userId) {
      return currentUser.fullName || currentUser.email;
    }

    if (participant?.username) {
      return participant.username;
    }

    if (participant?.fullName) {
      return participant.fullName;
    }

    if (participant?.email) {
      return participant.email;
    }

    const profile = this.participantProfiles[userId];
    if (profile?.username) {
      return profile.username;
    }

    if (profile?.fullName) {
      return profile.fullName;
    }

    if (profile?.email) {
      return profile.email;
    }

    const ownerName = this.getProjectOwnerName(userId);
    if (ownerName) {
      return ownerName;
    }

    const contributorName = this.getProjectContributorName(userId);
    if (contributorName) {
      return contributorName;
    }

    return 'Loading name...';
  }

  private isCurrentUser(userId: number): boolean {
    return this.authService.currentUser()?.userId === userId;
  }

  private getProjectOwnerName(userId: number): string {
    if (!this.project || this.project.ownerId !== userId) {
      return '';
    }

    return this.project.ownerUsername || this.project.owner?.username || this.project.ownerFullName || this.project.owner?.fullName || this.project.owner?.email || '';
  }

  private getProjectContributorName(userId: number): string {
    const contributor = this.project?.contributors?.find((item) => item.userId === userId);
    if (contributor) {
      return contributor.username || contributor.fullName || contributor.email || '';
    }

    const contributorIndex = this.project?.contributorIds?.findIndex((item) => item === userId) ?? -1;
    if (contributorIndex >= 0 && this.project?.contributorUsernames?.[contributorIndex]) {
      return this.project.contributorUsernames[contributorIndex];
    }

    return '';
  }

  private buildChildPath(name: string): string {
    if (!this.selectedFile) {
      return name;
    }

    if (this.selectedFile.folder) {
      return `${this.selectedFile.path}/${name}`;
    }

    const parentPath = this.selectedFile.path.includes('/')
      ? this.selectedFile.path.substring(0, this.selectedFile.path.lastIndexOf('/'))
      : '';

    return parentPath ? `${parentPath}/${name}` : name;
  }

  private sortFiles(files: ProjectFile[]): ProjectFile[] {
    return [...files].sort((left, right) => {
      if (left.folder !== right.folder) {
        return left.folder ? -1 : 1;
      }

      return left.path.localeCompare(right.path);
    });
  }

  private sortSnapshots(snapshots: Snapshot[]): Snapshot[] {
    return [...snapshots].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  private sortExecutions(executions: ExecutionResponse[]): ExecutionResponse[] {
    return [...executions].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  private sortComments(comments: CommentItem[]): CommentItem[] {
    return [...comments].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }

  private sortSessions(sessions: CollabSession[]): CollabSession[] {
    return [...sessions].sort((left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  }
}
