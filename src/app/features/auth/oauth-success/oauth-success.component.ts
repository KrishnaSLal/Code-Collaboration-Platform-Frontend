import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-oauth-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './oauth-success.component.html',
  styleUrl: './oauth-success.component.css'
})
export class OAuthSuccessComponent implements OnInit {
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const token = params.get('token');
    const userId = Number(params.get('userId'));
    const fullName = params.get('fullName') || '';
    const email = params.get('email') || '';

    if (!token || !userId || !fullName || !email) {
      this.errorMessage = 'Google login did not return a valid CodeSync session.';
      return;
    }

    this.authService.storeOAuthLogin({
      userId,
      fullName,
      email,
      token,
      message: 'Google login successful'
    });
    this.router.navigateByUrl('/dashboard');
  }
}
