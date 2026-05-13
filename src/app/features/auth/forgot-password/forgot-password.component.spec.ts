import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  function createComponent(overrides: Partial<Record<'forgotPassword' | 'verifyOtp' | 'resetPassword', unknown>> = {}) {
    const authService = {
      forgotPassword: vi.fn(() => overrides.forgotPassword ?? of({ message: 'OTP sent' })),
      verifyOtp: vi.fn(() => overrides.verifyOtp ?? of({ message: 'OTP verified' })),
      resetPassword: vi.fn(() => overrides.resetPassword ?? of({ message: 'Password changed' }))
    };
    const component = new ForgotPasswordComponent(new FormBuilder(), authService as any);

    return { component, authService };
  }

  it('should complete the email, OTP, and password reset flow', () => {
    const { component, authService } = createComponent();

    component.emailForm.setValue({ email: 'user@example.com' });
    component.onSubmit();

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'user@example.com' });
    expect(component.verifiedEmail).toBe('user@example.com');
    expect(component.step).toBe('otp');
    expect(component.successMessage).toBe('OTP sent');

    component.otpForm.setValue({ otp: '123456' });
    component.verifyOtp();

    expect(authService.verifyOtp).toHaveBeenCalledWith({
      email: 'user@example.com',
      otp: '123456'
    });
    expect(component.step).toBe('password');

    component.resetPasswordForm.setValue({
      newPassword: 'new-secret',
      confirmPassword: 'new-secret'
    });
    component.resetPassword();

    expect(authService.resetPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      newPassword: 'new-secret'
    });
    expect(component.step).toBe('complete');
    expect(component.successMessage).toBe('Password changed');
  });

  it('should use default success messages when API responses omit them', () => {
    const { component } = createComponent({
      forgotPassword: of({ message: '' }),
      verifyOtp: of({ message: '' }),
      resetPassword: of({ message: '' })
    });

    component.emailForm.setValue({ email: 'user@example.com' });
    component.onSubmit();
    expect(component.successMessage).toBe('OTP sent successfully. Please verify it to continue.');

    component.otpForm.setValue({ otp: '123456' });
    component.verifyOtp();
    expect(component.successMessage).toBe('OTP verified successfully. Choose a new password.');

    component.resetPasswordForm.setValue({
      newPassword: 'new-secret',
      confirmPassword: 'new-secret'
    });
    component.resetPassword();
    expect(component.successMessage).toBe('Password reset successfully. You can now login with your new password.');
  });

  it('should mark invalid forms touched and require the verified email', () => {
    const { component, authService } = createComponent();
    const emailTouched = vi.spyOn(component.emailForm, 'markAllAsTouched');
    const otpTouched = vi.spyOn(component.otpForm, 'markAllAsTouched');
    const passwordTouched = vi.spyOn(component.resetPasswordForm, 'markAllAsTouched');

    component.onSubmit();
    component.verifyOtp();
    component.resetPassword();

    expect(emailTouched).toHaveBeenCalled();
    expect(otpTouched).toHaveBeenCalled();
    expect(passwordTouched).toHaveBeenCalled();
    expect(authService.forgotPassword).not.toHaveBeenCalled();
    expect(authService.verifyOtp).not.toHaveBeenCalled();
    expect(authService.resetPassword).not.toHaveBeenCalled();
  });

  it('should validate matching passwords and expose form controls', () => {
    const { component } = createComponent();

    component.resetPasswordForm.setValue({
      newPassword: 'secret',
      confirmPassword: 'different'
    });

    expect(component.resetPasswordForm.hasError('passwordMismatch')).toBe(true);
    expect(component.email).toBe(component.emailForm.get('email'));
    expect(component.otp).toBe(component.otpForm.get('otp'));
    expect(component.newPassword).toBe(component.resetPasswordForm.get('newPassword'));
    expect(component.confirmPassword).toBe(component.resetPasswordForm.get('confirmPassword'));
  });

  it('should surface API and gateway errors for each step', () => {
    const apiError = new HttpErrorResponse({
      status: 400,
      error: { message: 'Unknown email' }
    });
    const { component } = createComponent({
      forgotPassword: throwError(() => apiError)
    });

    component.emailForm.setValue({ email: 'user@example.com' });
    component.onSubmit();

    expect(component.errorMessage).toBe('Unknown email');

    const gatewayError = new HttpErrorResponse({
      status: 500,
      error: '<html>Gateway</html>'
    });
    const otpComponent = createComponent({
      verifyOtp: throwError(() => gatewayError)
    }).component;
    otpComponent.verifiedEmail = 'user@example.com';
    otpComponent.otpForm.setValue({ otp: '123456' });
    otpComponent.verifyOtp();

    expect(otpComponent.errorMessage).toContain('Unable to reach the API gateway');
  });

  it('should surface string, network, server, and fallback reset errors', () => {
    const stringErrorComponent = createComponent({
      resetPassword: throwError(() => new HttpErrorResponse({ status: 400, error: 'Reset token expired' }))
    }).component;
    stringErrorComponent.verifiedEmail = 'user@example.com';
    stringErrorComponent.resetPasswordForm.setValue({
      newPassword: 'new-secret',
      confirmPassword: 'new-secret'
    });
    stringErrorComponent.resetPassword();
    expect(stringErrorComponent.errorMessage).toBe('Reset token expired');

    const networkComponent = createComponent({
      forgotPassword: throwError(() => new HttpErrorResponse({ status: 0, error: '' }))
    }).component;
    networkComponent.emailForm.setValue({ email: 'user@example.com' });
    networkComponent.onSubmit();
    expect(networkComponent.errorMessage).toContain('Unable to reach the API gateway');

    const serverComponent = createComponent({
      forgotPassword: throwError(() => new HttpErrorResponse({ status: 500, error: '' }))
    }).component;
    serverComponent.emailForm.setValue({ email: 'user@example.com' });
    serverComponent.onSubmit();
    expect(serverComponent.errorMessage).toContain('OTP email could not be sent');

    const fallbackComponent = createComponent({
      verifyOtp: throwError(() => new HttpErrorResponse({ status: 400, error: '' }))
    }).component;
    fallbackComponent.verifiedEmail = 'user@example.com';
    fallbackComponent.otpForm.setValue({ otp: '123456' });
    fallbackComponent.verifyOtp();
    expect(fallbackComponent.errorMessage).toBe('OTP verification failed. Please try again.');
  });

  it('should toggle both password visibility flags', () => {
    const { component } = createComponent();

    component.toggleNewPasswordVisibility();
    component.toggleConfirmPasswordVisibility();

    expect(component.showNewPassword).toBe(true);
    expect(component.showConfirmPassword).toBe(true);
  });
});
