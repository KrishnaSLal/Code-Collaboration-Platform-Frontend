import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AddCommentPayload, CommentItem } from '../models/codesync.model';

@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly baseUrl = environment.commentServiceBaseUrl;

  constructor(private http: HttpClient) {}

  getCommentsByFile(fileId: number): Observable<CommentItem[]> {
    return this.http.get<CommentItem[]>(`${this.baseUrl}/file/${fileId}`);
  }

  addComment(payload: AddCommentPayload): Observable<CommentItem> {
    return this.http.post<CommentItem>(this.baseUrl, payload);
  }

  replyToComment(parentCommentId: number, payload: AddCommentPayload): Observable<CommentItem> {
    return this.http.post<CommentItem>(`${this.baseUrl}/${parentCommentId}/replies`, {
      ...payload,
      parentCommentId
    });
  }

  resolveComment(commentId: number): Observable<CommentItem> {
    return this.http.put<CommentItem>(`${this.baseUrl}/${commentId}/resolve`, {});
  }

  unresolveComment(commentId: number): Observable<CommentItem> {
    return this.http.put<CommentItem>(`${this.baseUrl}/${commentId}/unresolve`, {});
  }
}
