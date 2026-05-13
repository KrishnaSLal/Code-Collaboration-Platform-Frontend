import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

import {
  AuthResponse,
  CurrentUser,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterRequest,
  ResetPasswordRequest,
  UserSummary,
  VerifyOtpRequest
} from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private readonly baseUrl = environment.authServiceBaseUrl;

  private readonly tokenKey = 'codesync_token';
  private readonly emailKey = 'codesync_email';
  private readonly userIdKey = 'codesync_user_id';
  private readonly fullNameKey = 'codesync_full_name';
  private readonly roleKey = 'codesync_role';
  private readonly authKeys = [this.tokenKey, this.emailKey, this.userIdKey, this.fullNameKey, this.roleKey];

  readonly currentUser = signal<CurrentUser | null>(this.readStoredUser());

  constructor(private http: HttpClient) {}

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/register`, payload);
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/login`, payload)
      .pipe(tap((res) => this.storeAuth(res)));
  }

  adminLogin(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.baseUrl}/admin/login`, payload)
      .pipe(tap((res) => this.storeAuth(res)));
  }

  forgotPassword(payload: ForgotPasswordRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/forgot-password`, payload);
  }

  verifyOtp(payload: VerifyOtpRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/verify-otp`, payload);
  }

  resetPassword(payload: ResetPasswordRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/reset-password`, payload);
  }

  getUsersByIds(userIds: number[]): Observable<UserSummary[]> {
    const uniqueIds = [...new Set(userIds.filter((userId) => Number.isFinite(userId)))];
    if (!uniqueIds.length) {
      return of([]);
    }

    return this.http.get<UserSummary[]>(`${this.baseUrl}/users`, {
      params: { ids: uniqueIds.join(',') }
    });
  }

  logout(): void {
    this.clearStoredAuth(sessionStorage);
    this.clearStoredAuth(localStorage);
    this.currentUser.set(null);
  }

  storeOAuthLogin(res: AuthResponse): void {
    this.storeAuth(res);
  }

  isLoggedIn(): boolean {
    return !!this.currentUser();
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenKey) || localStorage.getItem(this.tokenKey);
  }

  private storeAuth(res: AuthResponse): void {
    sessionStorage.setItem(this.tokenKey, res.token);
    sessionStorage.setItem(this.emailKey, res.email);
    sessionStorage.setItem(this.userIdKey, String(res.userId));
    sessionStorage.setItem(this.fullNameKey, res.fullName);
    if (res.role) {
      sessionStorage.setItem(this.roleKey, res.role);
    }
    this.clearStoredAuth(localStorage);
    this.currentUser.set(this.readStoredUser());
  }

  private readStoredUser(): CurrentUser | null {
    const storage = sessionStorage.getItem(this.tokenKey) ? sessionStorage : localStorage;
    const token = storage.getItem(this.tokenKey);
    const email = storage.getItem(this.emailKey);
    const userId = storage.getItem(this.userIdKey);
    const fullName = storage.getItem(this.fullNameKey);
    const role = storage.getItem(this.roleKey);

    if (!token || !email || !userId || !fullName) {
      return null;
    }

    const currentUser = {
      userId: Number(userId),
      fullName,
      email,
      token,
      role: role || undefined
    };

    if (storage === localStorage) {
      this.migrateLegacyAuthToTab();
    }

    return currentUser;
  }

  private clearStoredAuth(storage: Storage): void {
    this.authKeys.forEach((key) => storage.removeItem(key));
  }

  private migrateLegacyAuthToTab(): void {
    this.authKeys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value) {
        sessionStorage.setItem(key, value);
      }
    });
    this.clearStoredAuth(localStorage);
  }
}
