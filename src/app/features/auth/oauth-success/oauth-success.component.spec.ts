import { OAuthSuccessComponent } from './oauth-success.component';

describe('OAuthSuccessComponent', () => {
  function createComponent(values: Record<string, string | null>) {
    const route = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => values[key] ?? null
        }
      }
    };
    const router = {
      navigateByUrl: vi.fn()
    };
    const authService = {
      storeOAuthLogin: vi.fn()
    };
    const component = new OAuthSuccessComponent(route as any, router as any, authService as any);

    return { component, router, authService };
  }

  it('should store OAuth session details and navigate to dashboard', () => {
    const { component, authService, router } = createComponent({
      token: 'oauth-token',
      userId: '17',
      fullName: 'OAuth User',
      email: 'oauth@example.com'
    });

    component.ngOnInit();

    expect(authService.storeOAuthLogin).toHaveBeenCalledWith({
      userId: 17,
      fullName: 'OAuth User',
      email: 'oauth@example.com',
      token: 'oauth-token',
      message: 'Google login successful'
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
    expect(component.errorMessage).toBe('');
  });

  it('should show an error when OAuth query params are incomplete', () => {
    const { component, authService, router } = createComponent({
      token: null,
      userId: '17',
      fullName: 'OAuth User',
      email: 'oauth@example.com'
    });

    component.ngOnInit();

    expect(component.errorMessage).toBe('Google login did not return a valid CodeSync session.');
    expect(authService.storeOAuthLogin).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
