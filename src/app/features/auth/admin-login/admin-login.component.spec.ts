import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { AdminLoginComponent } from './admin-login.component';

describe('AdminLoginComponent', () => {
  const authResponse = {
    userId: 1,
    fullName: 'Admin User',
    email: 'admin@example.com',
    token: 'admin-token',
    message: 'Admin login successful',
    role: 'ADMIN'
  };

  function createComponent(adminLoginResult = of(authResponse)) {
    const authService = {
      adminLogin: vi.fn(() => adminLoginResult)
    };
    const router = {
      navigateByUrl: vi.fn()
    };
    const component = new AdminLoginComponent(new FormBuilder(), authService as any, router as any);

    return { component, authService, router };
  }

  it('should skip admin login when the form is invalid', () => {
    const { component, authService } = createComponent();
    const markAllAsTouched = vi.spyOn(component.adminLoginForm, 'markAllAsTouched');

    component.onSubmit();

    expect(markAllAsTouched).toHaveBeenCalled();
    expect(authService.adminLogin).not.toHaveBeenCalled();
  });

  it('should submit trimmed admin credentials and navigate to dashboard', () => {
    const { component, authService, router } = createComponent();

    component.adminLoginForm.setValue({
      email: 'admin@example.com',
      password: 'root'
    });
    component.onSubmit();

    expect(authService.adminLogin).toHaveBeenCalledWith({
      email: 'admin@example.com',
      password: 'root'
    });
    expect(component.successMessage).toBe('Admin login successful');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('should show string, object, and reachability errors', () => {
    const stringError = new HttpErrorResponse({
      status: 403,
      error: 'Admin access denied'
    });
    const { component } = createComponent(throwError(() => stringError));

    component.adminLoginForm.setValue({
      email: 'admin@example.com',
      password: 'wrong'
    });
    component.onSubmit();

    expect(component.errorMessage).toBe('Admin access denied');

    const networkError = new HttpErrorResponse({ status: 0, error: '' });
    const second = createComponent(throwError(() => networkError)).component;
    second.adminLoginForm.setValue({
      email: 'admin@example.com',
      password: 'wrong'
    });
    second.onSubmit();

    expect(second.errorMessage).toContain('Unable to reach auth-service');
  });

  it('should expose controls and toggle password visibility', () => {
    const { component } = createComponent();

    expect(component.email).toBe(component.adminLoginForm.get('email'));
    expect(component.password).toBe(component.adminLoginForm.get('password'));

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);
  });
});
