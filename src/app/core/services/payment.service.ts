import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

export const FREE_EXECUTION_LIMIT = 5;
export const EXECUTION_PASS_PRICE_IN_PAISE = 49900;
export const EXECUTION_PASS_PLAN_NAME = 'CodeSync Execution Pass';

export interface PaymentOrderRequest {
  amount: number;
  currency: string;
  planName: string;
  userId: number;
}

export interface PaymentOrderResponse {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface VerifyPaymentRequest {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private readonly baseUrl = '/api/v1/payments';
  private readonly executionPassKeyPrefix = 'codesync_execution_pass_user_';

  constructor(private http: HttpClient) {}

  createOrder(payload: PaymentOrderRequest): Observable<PaymentOrderResponse> {
    return this.http.post<PaymentOrderResponse>(`${this.baseUrl}/orders`, payload);
  }

  verifyPayment(payload: VerifyPaymentRequest): Observable<VerifyPaymentResponse> {
    return this.http.post<VerifyPaymentResponse>(`${this.baseUrl}/verify`, payload);
  }

  getPaymentErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
      }

      if (error.error?.message) {
        return error.error.message;
      }
    }

    return fallback;
  }

  hasExecutionPass(userId: number): boolean {
    return localStorage.getItem(this.getExecutionPassKey(userId)) === 'active';
  }

  activateExecutionPass(userId: number): void {
    localStorage.setItem(this.getExecutionPassKey(userId), 'active');
  }

  private getExecutionPassKey(userId: number): string {
    return `${this.executionPassKeyPrefix}${userId}`;
  }
}
