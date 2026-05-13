import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordRequest, ResetPasswordRequest, VerifyOtpRequest } from '../../../core/models/auth.model';

type ForgotPasswordStep = 'email' | 'otp' | 'password' | 'complete';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css'
})
export class ForgotPasswordComponent {
  loading = false;
  successMessage = '';
  errorMessage = '';
  showNewPassword = false;
  showConfirmPassword = false;
  step: ForgotPasswordStep = 'email';
  emailForm: FormGroup;
  otpForm: FormGroup;
  resetPasswordForm: FormGroup;
  verifiedEmail = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    this.otpForm = this.fb.group({
      otp: ['', [Validators.required, Validators.pattern(/^[0-9]{4,8}$/)]]
    });

    this.resetPasswordForm = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(4)]],
        confirmPassword: ['', [Validators.required]]
      },
      { validators: this.passwordsMatch }
    );
  }

  onSubmit(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload: ForgotPasswordRequest = {
      email: this.emailForm.value.email?.trim() || ''
    };

    this.authService.forgotPassword(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.verifiedEmail = payload.email;
        this.step = 'otp';
        this.successMessage = response.message || 'OTP sent successfully. Please verify it to continue.';
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Unable to send OTP. Please try again.');
      }
    });
  }

  get email() {
    return this.emailForm.get('email');
  }

  get otp() {
    return this.otpForm.get('otp');
  }

  get newPassword() {
    return this.resetPasswordForm.get('newPassword');
  }

  get confirmPassword() {
    return this.resetPasswordForm.get('confirmPassword');
  }

  verifyOtp(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.otpForm.invalid || !this.verifiedEmail) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload: VerifyOtpRequest = {
      email: this.verifiedEmail,
      otp: this.otpForm.value.otp?.trim() || ''
    };

    this.authService.verifyOtp(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.step = 'password';
        this.successMessage = response.message || 'OTP verified successfully. Choose a new password.';
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'OTP verification failed. Please try again.');
      }
    });
  }

  resetPassword(): void {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.resetPasswordForm.invalid || !this.verifiedEmail) {
      this.resetPasswordForm.markAllAsTouched();
      return;
    }

    this.loading = true;

    const payload: ResetPasswordRequest = {
      email: this.verifiedEmail,
      newPassword: this.resetPasswordForm.value.newPassword || ''
    };

    this.authService.resetPassword(payload).subscribe({
      next: (response) => {
        this.loading = false;
        this.step = 'complete';
        this.successMessage = response.message || 'Password reset successfully. You can now login with your new password.';
        this.emailForm.reset();
        this.otpForm.reset();
        this.resetPasswordForm.reset();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.getErrorMessage(error, 'Password reset failed. Please try again.');
      }
    });
  }

  toggleNewPasswordVisibility(): void {
    this.showNewPassword = !this.showNewPassword;
  }

  toggleConfirmPasswordVisibility(): void {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  private passwordsMatch(control: AbstractControl): ValidationErrors | null {
    const newPassword = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!newPassword || !confirmPassword) {
      return null;
    }

    return newPassword === confirmPassword ? null : { passwordMismatch: true };
  }

  private getErrorMessage(error: HttpErrorResponse, fallback: string): string {
    if (error.error?.message) {
      return error.error.message;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      const message = error.error.trim();

      if (message.startsWith('<!DOCTYPE') || message.startsWith('<html')) {
        return 'Unable to reach the API gateway. Please check that the backend is running on localhost:8080.';
      }

      if (!message.startsWith('<!DOCTYPE') && !message.startsWith('<html')) {
        return message;
      }
    }

    if (error.status === 0) {
      return 'Unable to reach the API gateway. Please check that the backend is running on localhost:8080.';
    }

    if (error.status >= 500) {
      return 'OTP email could not be sent. Please check the auth-service mail credentials and try again.';
    }

    return fallback;
  }
}
