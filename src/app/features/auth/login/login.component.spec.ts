import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  const authResponse = {
    userId: 7,
    fullName: 'Krishna Lal',
    email: 'krishna@example.com',
    token: 'jwt-token',
    message: 'Welcome back'
  };

  function createComponent(loginResult = of(authResponse)) {
    const authService = {
      login: vi.fn(() => loginResult)
    };
    const router = {
      navigateByUrl: vi.fn()
    };
    const component = new LoginComponent(new FormBuilder(), authService as any, router as any);

    return { component, authService, router };
  }

  it('should mark the form touched and skip login when invalid', () => {
    const { component, authService } = createComponent();
    const markAllAsTouched = vi.spyOn(component.loginForm, 'markAllAsTouched');

    component.onSubmit();

    expect(markAllAsTouched).toHaveBeenCalled();
    expect(authService.login).not.toHaveBeenCalled();
    expect(component.loading).toBe(false);
  });

  it('should login with valid credentials and navigate to dashboard', () => {
    const { component, authService, router } = createComponent();

    component.loginForm.setValue({
      email: 'krishna@example.com',
      password: 'secret'
    });
    component.onSubmit();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'krishna@example.com',
      password: 'secret'
    });
    expect(component.loading).toBe(false);
    expect(component.successMessage).toBe('Welcome back');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('should use the default success message when the API omits one', () => {
    const { component } = createComponent(of({ ...authResponse, message: '' }));

    component.loginForm.setValue({
      email: 'krishna@example.com',
      password: 'secret'
    });
    component.onSubmit();

    expect(component.successMessage).toBe('Login successful');
  });

  it('should show service and fallback errors without navigating', () => {
    const serviceError = new HttpErrorResponse({
      status: 401,
      error: { message: 'Invalid credentials' }
    });
    const { component, router } = createComponent(throwError(() => serviceError));

    component.loginForm.setValue({
      email: 'krishna@example.com',
      password: 'wrong'
    });
    component.onSubmit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Invalid credentials');
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('should show an auth-service reachability message for HTML or network errors', () => {
    const htmlError = new HttpErrorResponse({
      status: 502,
      error: '<html>Bad Gateway</html>'
    });
    const { component } = createComponent(throwError(() => htmlError));

    component.loginForm.setValue({
      email: 'krishna@example.com',
      password: 'secret'
    });
    component.onSubmit();

    expect(component.errorMessage).toContain('Unable to reach auth-service');
  });

  it('should map plain, network, and client errors to the existing login messages', () => {
    const cases = [
      {
        error: new HttpErrorResponse({ status: 400, error: 'Plain backend failure' }),
        expected: 'Plain backend failure'
      },
      {
        error: new HttpErrorResponse({ status: 0, error: '' }),
        expected: 'Unable to reach auth-service. Please check that it is running on localhost:8081.'
      },
      {
        error: new HttpErrorResponse({ status: 400, error: '' }),
        expected: 'Login failed. Please check your credentials.'
      }
    ];

    cases.forEach(({ error, expected }) => {
      const { component } = createComponent(throwError(() => error));
      component.loginForm.setValue({
        email: 'krishna@example.com',
        password: 'secret'
      });

      component.onSubmit();

      expect(component.errorMessage).toBe(expected);
    });
  });

  it('should expose controls and toggle password visibility', () => {
    const { component } = createComponent();

    expect(component.email).toBe(component.loginForm.get('email'));
    expect(component.password).toBe(component.loginForm.get('password'));

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(false);
  });
});
