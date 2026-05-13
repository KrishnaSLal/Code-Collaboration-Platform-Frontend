import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthResponse } from '../models/auth.model';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const authResponse: AuthResponse = {
    userId: 7,
    fullName: 'Krishna',
    email: 'krishna@example.com',
    role: 'USER',
    token: 'jwt-token',
    message: 'Login successful!'
  };

  function setup() {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    return {
      service: TestBed.inject(AuthService),
      http: TestBed.inject(HttpTestingController)
    };
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController, null)?.verify();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('register should POST to the register endpoint', () => {
    const { service, http } = setup();
    const payload = {
      fullName: 'Krishna',
      email: 'krishna@example.com',
      password: 'secret',
      mobileNumber: '9999999999'
    };

    service.register(payload).subscribe((response) => {
      expect(response).toEqual(authResponse);
    });

    const req = http.expectOne(`${environment.authServiceBaseUrl}/register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(authResponse);
  });

  it('login should store auth details in session storage', () => {
    const { service, http } = setup();
    const payload = { email: 'krishna@example.com', password: 'secret' };

    service.login(payload).subscribe((response) => {
      expect(response).toEqual(authResponse);
    });

    const req = http.expectOne(`${environment.authServiceBaseUrl}/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(authResponse);

    expect(sessionStorage.getItem('codesync_token')).toBe('jwt-token');
    expect(sessionStorage.getItem('codesync_email')).toBe('krishna@example.com');
    expect(sessionStorage.getItem('codesync_user_id')).toBe('7');
    expect(service.currentUser()).toEqual({
      userId: 7,
      fullName: 'Krishna',
      email: 'krishna@example.com',
      token: 'jwt-token',
      role: 'USER'
    });
  });

  it('adminLogin should POST to the admin login endpoint and store auth', () => {
    const { service, http } = setup();
    const payload = { email: 'admin@example.com', password: 'secret' };

    service.adminLogin(payload).subscribe();

    const req = http.expectOne(`${environment.authServiceBaseUrl}/admin/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ ...authResponse, email: 'admin@example.com', role: 'ADMIN' });

    expect(service.currentUser()?.role).toBe('ADMIN');
  });

  it('should call password reset endpoints', () => {
    const { service, http } = setup();

    service.forgotPassword({ email: 'krishna@example.com' }).subscribe();
    let req = http.expectOne(`${environment.authServiceBaseUrl}/forgot-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'krishna@example.com' });
    req.flush(authResponse);

    service.verifyOtp({ email: 'krishna@example.com', otp: '123456' }).subscribe();
    req = http.expectOne(`${environment.authServiceBaseUrl}/verify-otp`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'krishna@example.com', otp: '123456' });
    req.flush(authResponse);

    service.resetPassword({ email: 'krishna@example.com', newPassword: 'new-secret' }).subscribe();
    req = http.expectOne(`${environment.authServiceBaseUrl}/reset-password`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'krishna@example.com', newPassword: 'new-secret' });
    req.flush(authResponse);
  });

  it('getUsersByIds should request registered user summaries for unique ids', () => {
    const { service, http } = setup();

    service.getUsersByIds([7, 7, 11]).subscribe((users) => {
      expect(users).toEqual([
        {
          userId: 7,
          fullName: 'Krishna',
          email: 'krishna@example.com',
          role: 'USER'
        }
      ]);
    });

    const req = http.expectOne((request) =>
      request.url === `${environment.authServiceBaseUrl}/users` &&
      request.params.get('ids') === '7,11'
    );
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        userId: 7,
        fullName: 'Krishna',
        email: 'krishna@example.com',
        role: 'USER'
      }
    ]);
  });

  it('getUsersByIds should return an empty list without making a request when ids are empty', () => {
    const { service } = setup();

    service.getUsersByIds([]).subscribe((users) => {
      expect(users).toEqual([]);
    });
  });

  it('logout should clear session and local storage auth keys', () => {
    const { service } = setup();
    service.storeOAuthLogin(authResponse);
    localStorage.setItem('codesync_token', 'legacy-token');

    service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(service.getToken()).toBeNull();
    expect(sessionStorage.getItem('codesync_token')).toBeNull();
    expect(localStorage.getItem('codesync_token')).toBeNull();
  });

  it('should migrate legacy local storage auth to session storage on startup', () => {
    localStorage.setItem('codesync_token', 'legacy-token');
    localStorage.setItem('codesync_email', 'legacy@example.com');
    localStorage.setItem('codesync_user_id', '11');
    localStorage.setItem('codesync_full_name', 'Legacy User');
    localStorage.setItem('codesync_role', 'ADMIN');

    const { service } = setup();

    expect(service.currentUser()).toEqual({
      userId: 11,
      fullName: 'Legacy User',
      email: 'legacy@example.com',
      token: 'legacy-token',
      role: 'ADMIN'
    });
    expect(sessionStorage.getItem('codesync_token')).toBe('legacy-token');
    expect(localStorage.getItem('codesync_token')).toBeNull();
  });
});
