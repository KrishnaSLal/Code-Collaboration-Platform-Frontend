import { Routes } from '@angular/router';
import { LoginComponent } from './features/auth/login/login.component';
import { AdminLoginComponent } from './features/auth/admin-login/admin-login.component';
import { OAuthSuccessComponent } from './features/auth/oauth-success/oauth-success.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { ForgotPasswordComponent } from './features/auth/forgot-password/forgot-password.component';
import { HomeComponent } from './features/home/home.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { WorkspaceComponent } from './features/workspace/workspace.component';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'guest', component: HomeComponent, data: { guestMode: true } },
  { path: 'login', component: LoginComponent },
  { path: 'admin-login', component: AdminLoginComponent },
  { path: 'oauth-success', component: OAuthSuccessComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'forgot-password', component: ForgotPasswordComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
  { path: 'projects/:projectId', component: WorkspaceComponent },
  { path: '**', redirectTo: '' }
];
