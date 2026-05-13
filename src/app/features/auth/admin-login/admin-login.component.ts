import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LoginRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  showPassword = false;
  adminLoginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.adminLoginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.adminLoginForm.invalid) {
      this.adminLoginForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload: LoginRequest = {
      email: this.adminLoginForm.value.email?.trim() || '',
      password: this.adminLoginForm.value.password || ''
    };

    this.authService.adminLogin(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message || 'Admin login successful';
        this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error);
      }
    });
  }

  get email() {
    return this.adminLoginForm.get('email');
  }

  get password() {
    return this.adminLoginForm.get('password');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private getErrorMessage(error: HttpErrorResponse): string {
    if (error.error?.message) {
      return error.error.message;
    }

    if (typeof error.error === 'string' && error.error.trim() && !error.error.trim().startsWith('<')) {
      return error.error.trim();
    }

    if (error.status === 0 || error.status >= 500) {
      return 'Unable to reach auth-service. Please check that it is running on localhost:8081.';
    }

    return 'Admin login failed. Please check your administrator credentials.';
  }
}
