export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
  mobileNumber: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface ResetPasswordRequest {
  email: string;
  newPassword: string;
}

export interface AuthResponse {
  userId: number;
  fullName: string;
  token: string;
  message: string;
  email: string;
  role?: string;
}

export interface CurrentUser {
  userId: number;
  fullName: string;
  email: string;
  token: string;
  role?: string;
}

export interface UserSummary {
  userId: number;
  username?: string;
  fullName: string;
  email: string;
  role?: string;
}
