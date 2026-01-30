import type { Sale } from '../types';
import { createMpesaClient, type MpesaBackendAdapter } from './mpesaService';

export type PaymentProvider = 'cash' | 'card' | 'mpesa';

export type PaymentStatus = 'initiated' | 'pending' | 'success' | 'failed';

export interface PaymentResult {
  status: PaymentStatus;
  provider: PaymentProvider;
  providerRef?: string;
  message?: string;
}

/**
 * A thin abstraction so the POS UI doesn't depend on any single gateway.
 * Start with M-Pesa, later plug in card terminals, other mobile money, etc.
 */
export class PaymentService {
  private mpesa = createMpesaClient(this.mpesaBackend);

  constructor(private readonly mpesaBackend?: MpesaBackendAdapter) {}

  async startMpesaStk(args: { saleDraftId: string; phone: string; amount: number; accountRef: string }): Promise<{ checkoutRequestId: string }> {
    return this.mpesa.sendStkRequest(args.phone, args.amount, args.accountRef);
  }

  async pollMpesa(checkoutRequestId: string): Promise<PaymentResult> {
    const result = await this.mpesa.checkTransactionStatus(checkoutRequestId);
    return {
      status: result.success ? 'success' : 'failed',
      provider: 'mpesa',
      providerRef: result.receipt,
      message: result.message
    };
  }

  /**
   * For offline policy: we can mark a sale as pending payment and settle later.
   * (Implementation comes after we add a proper ledger/event log.)
   */
  buildPendingPaymentSalePatch(_sale: Sale): Partial<Sale> {
    return { status: 'completed' };
  }
}

