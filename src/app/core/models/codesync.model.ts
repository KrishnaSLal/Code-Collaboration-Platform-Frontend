export interface Project {
  projectId: number;
  ownerId: number;
  ownerUsername?: string;
  ownerFullName?: string;
  owner?: ProjectContributor;
  projectName: string;
  description: string;
  language: string;
  visibility: string;
  archived: boolean;
  starCount: number;
  forkCount: number;
  contributors?: ProjectContributor[];
  contributorUsernames?: string[];
  contributorIds?: number[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectContributor {
  userId?: number;
  username?: string;
  fullName?: string;
  email?: string;
  role?: string;
}

export interface ProjectPayload {
  ownerId: number;
  projectName: string;
  description: string;
  language: string;
  visibility: string;
}

export interface ProjectFile {
  fileId: number;
  projectId: number;
  name: string;
  path: string;
  language: string | null;
  content: string;
  size: number;
  folder: boolean;
  createdById: number;
  lastEditedBy: number;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FilePayload {
  projectId: number;
  name: string;
  path: string;
  language: string;
  content: string;
  createdById: number;
}

export interface FolderPayload {
  projectId: number;
  name: string;
  path: string;
  createdById: number;
}

export interface ExecutionRequestPayload {
  projectId: number;
  fileId: number;
  userId: number;
  language: string;
  sourceCode: string;
  stdin: string;
}

export interface ExecutionResponse {
  jobId: string;
  projectId: number;
  fileId: number;
  userId: number;
  language: string;
  sourceCode: string;
  stdin: string;
  status: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  createdAt: string;
  completedAt: string | null;
}

export interface LanguageInfo {
  language: string;
  version: string;
}

export interface ExecutionStats {
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  cancelledExecutions: number;
}

export interface Snapshot {
  snapshotId: string;
  projectId: number;
  fileId: number;
  authorId: number;
  authorUsername?: string;
  authorFullName?: string;
  authorEmail?: string;
  message: string;
  content: string;
  hash: string;
  parentSnapshotId: string | null;
  branch: string;
  tag: string | null;
  createdAt: string;
}

export interface CreateSnapshotPayload {
  projectId: number;
  fileId: number;
  authorId: number;
  message: string;
  content: string;
  parentSnapshotId: string | null;
  branch: string;
}

export interface DiffResponse {
  snapshotIdOne: string;
  snapshotIdTwo: string;
  diffResult: string;
}

export interface CommentItem {
  commentId: number;
  projectId: number;
  fileId: number;
  authorId: number;
  content: string;
  lineNumber: number | null;
  columnNumber: number | null;
  parentCommentId: number | null;
  resolved: boolean;
  snapshotId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddCommentPayload {
  projectId: number;
  fileId: number;
  authorId: number;
  content: string;
  lineNumber: number | null;
  columnNumber: number | null;
  parentCommentId: number | null;
  snapshotId: string | null;
}

export interface CollabSession {
  sessionId: string;
  projectId: number;
  fileId: number;
  ownerId: number;
  status: string;
  language: string;
  createdAt: string;
  endedAt: string | null;
  maxParticipants: number | null;
  passwordProtected: boolean;
}

export interface Participant {
  participantId: number;
  sessionId: string;
  userId: number;
  username?: string;
  fullName?: string;
  email?: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  cursorLine: number | null;
  cursorCol: number | null;
  color: string;
}

export type CollabRealtimeMessageType =
  | 'USER_CONNECTED'
  | 'USER_DISCONNECTED'
  | 'PARTICIPANT_NAME'
  | 'CONTENT_CHANGE'
  | 'CURSOR_UPDATE';

export interface CollabRealtimeMessage {
  type: CollabRealtimeMessageType;
  sessionId: string;
  clientId?: string | null;
  userId: number | null;
  fileId?: number | null;
  content?: string | null;
  cursorLine?: number | null;
  cursorCol?: number | null;
  participant?: Participant | null;
  sentAt?: string;
}

export interface NotificationItem {
  notificationId: number;
  recipientId: number;
  actorId: number;
  type: string;
  title: string;
  message: string;
  relatedId: string;
  relatedType: string;
  isRead: boolean;
  createdAt: string;
}

export interface UnreadCount {
  recipientId: number;
  unreadCount: number;
}
