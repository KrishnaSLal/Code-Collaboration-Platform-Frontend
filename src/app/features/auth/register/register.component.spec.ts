import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  const authResponse = {
    userId: 8,
    fullName: 'Ananya Rao',
    email: 'ananya@example.com',
    token: 'jwt-token',
    message: 'Registered'
  };

  function createComponent(registerResult = of(authResponse)) {
    const authService = {
      register: vi.fn(() => registerResult)
    };
    const router = {
      navigateByUrl: vi.fn()
    };
    const component = new RegisterComponent(new FormBuilder(), authService as any, router as any);

    return { component, authService, router };
  }

  it('should mark the form touched and skip registration when invalid', () => {
    const { component, authService } = createComponent();
    const markAllAsTouched = vi.spyOn(component.registerForm, 'markAllAsTouched');

    component.onSubmit();

    expect(markAllAsTouched).toHaveBeenCalled();
    expect(authService.register).not.toHaveBeenCalled();
  });

  it('should trim text fields after validation, register, and navigate to login', () => {
    const { component, authService, router } = createComponent();

    component.registerForm.setValue({
      fullName: '  Ananya Rao  ',
      email: 'ananya@example.com',
      password: 'pass1234',
      mobileNumber: '9876543210'
    });
    component.onSubmit();

    expect(authService.register).toHaveBeenCalledWith({
      fullName: 'Ananya Rao',
      email: 'ananya@example.com',
      password: 'pass1234',
      mobileNumber: '9876543210'
    });
    expect(component.loading).toBe(false);
    expect(component.successMessage).toBe('Registered');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/login');
  });

  it('should use the default registration success message when omitted', () => {
    const { component } = createComponent(of({ ...authResponse, message: '' }));

    component.registerForm.setValue({
      fullName: '  Ananya Rao  ',
      email: 'ananya@example.com',
      password: 'pass1234',
      mobileNumber: '9876543210'
    });
    component.onSubmit();

    expect(component.successMessage).toBe('Registration successful');
  });

  it('should show backend error messages', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: 'Email already registered'
    });
    const { component } = createComponent(throwError(() => error));

    component.registerForm.setValue({
      fullName: 'Ananya Rao',
      email: 'ananya@example.com',
      password: 'pass1234',
      mobileNumber: '9876543210'
    });
    component.onSubmit();

    expect(component.loading).toBe(false);
    expect(component.errorMessage).toBe('Email already registered');
  });

  it('should use the auth-service reachability message for server failures', () => {
    const error = new HttpErrorResponse({ status: 500, error: '' });
    const { component } = createComponent(throwError(() => error));

    component.registerForm.setValue({
      fullName: 'Ananya Rao',
      email: 'ananya@example.com',
      password: 'pass1234',
      mobileNumber: '9876543210'
    });
    component.onSubmit();

    expect(component.errorMessage).toContain('Unable to reach auth-service');
  });

  it('should map structured, HTML, network, and client errors during registration', () => {
    const cases = [
      {
        error: new HttpErrorResponse({ status: 409, error: { message: 'Email exists' } }),
        expected: 'Email exists'
      },
      {
        error: new HttpErrorResponse({ status: 502, error: '<!DOCTYPE html><html></html>' }),
        expected: 'Unable to reach auth-service. Please check that it is running on localhost:8081.'
      },
      {
        error: new HttpErrorResponse({ status: 0, error: '' }),
        expected: 'Unable to reach auth-service. Please check that it is running on localhost:8081.'
      },
      {
        error: new HttpErrorResponse({ status: 400, error: '' }),
        expected: 'Registration failed. Please try again.'
      }
    ];

    cases.forEach(({ error, expected }) => {
      const { component } = createComponent(throwError(() => error));
      component.registerForm.setValue({
        fullName: 'Ananya Rao',
        email: 'ananya@example.com',
        password: 'pass1234',
        mobileNumber: '9876543210'
      });

      component.onSubmit();

      expect(component.errorMessage).toBe(expected);
    });
  });

  it('should expose controls and toggle password visibility', () => {
    const { component } = createComponent();

    expect(component.fullName).toBe(component.registerForm.get('fullName'));
    expect(component.email).toBe(component.registerForm.get('email'));
    expect(component.password).toBe(component.registerForm.get('password'));
    expect(component.mobileNumber).toBe(component.registerForm.get('mobileNumber'));

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(true);

    component.togglePasswordVisibility();
    expect(component.showPassword).toBe(false);
  });
});
