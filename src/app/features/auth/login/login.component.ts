import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/services/auth.service';
import { LoginRequest } from '../../../core/models/auth.model';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  showPassword = false;
  loginForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required]]
    });
  }

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload: LoginRequest = {
      email: this.loginForm.value.email?.trim() || '',
      password: this.loginForm.value.password || ''
    };

    this.authService.login(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message || 'Login successful';
        this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Login failed. Please check your credentials.');
      }
    });
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.error?.message) {
      return error.error.message;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      const message = error.error.trim();

      if (message.startsWith('<!DOCTYPE') || message.startsWith('<html')) {
        return 'Unable to reach auth-service. Please check that it is running on localhost:8081.';
      }

      if (!message.startsWith('<!DOCTYPE') && !message.startsWith('<html')) {
        return message;
      }
    }

    if (error.status === 0 || error.status >= 500) {
      return 'Unable to reach auth-service. Please check that it is running on localhost:8081.';
    }

    return fallback;
  }
}
