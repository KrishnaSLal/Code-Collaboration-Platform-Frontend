import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/services/auth.service';
import { RegisterRequest } from '../../../core/models/auth.model';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  showPassword = false;
  registerForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.registerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
      mobileNumber: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
    });
  }

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload: RegisterRequest = {
      fullName: this.registerForm.value.fullName?.trim() || '',
      email: this.registerForm.value.email?.trim() || '',
      password: this.registerForm.value.password || '',
      mobileNumber: this.registerForm.value.mobileNumber?.trim() || ''
    };

    this.authService.register(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message || 'Registration successful';
        this.router.navigateByUrl('/login');
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Registration failed. Please try again.');
      }
    });
  }

  get fullName() {
    return this.registerForm.get('fullName');
  }

  get email() {
    return this.registerForm.get('email');
  }

  get password() {
    return this.registerForm.get('password');
  }

  get mobileNumber() {
    return this.registerForm.get('mobileNumber');
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
