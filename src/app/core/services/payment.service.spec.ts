import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  EXECUTION_PASS_PLAN_NAME,
  EXECUTION_PASS_PRICE_IN_PAISE,
  PaymentOrderRequest,
  PaymentOrderResponse,
  PaymentService,
  VerifyPaymentRequest,
  VerifyPaymentResponse
} from './payment.service';

describe('PaymentService', () => {
  let service: PaymentService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(PaymentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  it('createOrder should POST payment order request', () => {
    const payload: PaymentOrderRequest = {
      amount: EXECUTION_PASS_PRICE_IN_PAISE,
      currency: 'INR',
      planName: EXECUTION_PASS_PLAN_NAME,
      userId: 7
    };
    const response: PaymentOrderResponse = {
      keyId: 'rzp_key',
      orderId: 'order_1',
      amount: payload.amount,
      currency: payload.currency,
      receipt: 'receipt_1'
    };

    service.createOrder(payload).subscribe((result) => expect(result).toEqual(response));

    const req = http.expectOne('/api/v1/payments/orders');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('verifyPayment should POST Razorpay verification payload', () => {
    const payload: VerifyPaymentRequest = {
      razorpayOrderId: 'order_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: 'signature'
    };
    const response: VerifyPaymentResponse = {
      verified: true,
      message: 'Payment verified successfully.'
    };

    service.verifyPayment(payload).subscribe((result) => expect(result).toEqual(response));

    const req = http.expectOne('/api/v1/payments/verify');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush(response);
  });

  it('getPaymentErrorMessage should prefer backend string and message errors', () => {
    expect(
      service.getPaymentErrorMessage(
        new HttpErrorResponse({ error: 'Gateway unavailable' }),
        'Fallback message'
      )
    ).toBe('Gateway unavailable');

    expect(
      service.getPaymentErrorMessage(
        new HttpErrorResponse({ error: { message: 'Payment failed' } }),
        'Fallback message'
      )
    ).toBe('Payment failed');

    expect(service.getPaymentErrorMessage(new Error('unknown'), 'Fallback message')).toBe('Fallback message');
  });

  it('should store and read execution pass activation per user', () => {
    expect(service.hasExecutionPass(7)).toBe(false);

    service.activateExecutionPass(7);

    expect(service.hasExecutionPass(7)).toBe(true);
    expect(service.hasExecutionPass(8)).toBe(false);
  });
});
