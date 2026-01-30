
/**
 * M-Pesa STK Push Service
 * Refined to simulate the multi-step Daraja API flow
 */

export const validateKenyanPhone = (phone: string): boolean => {
  const clean = phone.replace(/\s+/g, '');
  const regex = /^(?:254|\+254|0)?([71][0-9]{8})$/;
  return regex.test(clean);
};

export const formatPhoneForDisplay = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  let formatted = digits;
  if (digits.startsWith('0')) formatted = '254' + digits.slice(1);
  else if (digits.startsWith('7') || digits.startsWith('1')) formatted = '254' + digits;
  
  return `+${formatted.slice(0, 3)} ${formatted.slice(3, 6)} ${formatted.slice(6, 9)} ${formatted.slice(9)}`;
};

export const formatPhoneForApi = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) return '254' + digits.slice(1);
  if (digits.startsWith('7') || digits.startsWith('1')) return '254' + digits;
  return digits;
};

export interface StkPushResponse {
  success: boolean;
  receipt?: string;
  message: string;
}

export interface MpesaBackendAdapter {
  /**
   * Create an STK push on a trusted backend (Cloud Function / API).
   * Must return a checkoutRequestId that will be used for status polling.
   */
  createStkPush: (args: { phone: string; amount: number; accountRef: string }) => Promise<{ checkoutRequestId: string }>;

  /**
   * Check status from backend (which can query DB / Safaricom, or its own state).
   */
  checkStkStatus: (args: { checkoutRequestId: string }) => Promise<StkPushResponse>;
}

/**
 * Step 1: Send the initial STK Push request to Safaricom
 */
export const sendStkRequest = async (phone: string, amount: number): Promise<{ checkoutRequestId: string }> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ checkoutRequestId: `ws_CO_${Math.random().toString(36).slice(2, 10)}` });
    }, 1200);
  });
};

/**
 * Step 2: Poll for the transaction status (Simulates waiting for User PIN)
 */
export const checkTransactionStatus = async (requestId: string): Promise<StkPushResponse> => {
  return new Promise((resolve) => {
    // Simulating the 3-6 second window a user takes to enter a PIN
    setTimeout(() => {
      const isSuccess = Math.random() > 0.15; // 85% success rate
      if (isSuccess) {
        resolve({
          success: true,
          receipt: 'R' + Math.random().toString(36).substring(2, 10).toUpperCase(),
          message: 'Success. Transaction confirmed.'
        });
      } else {
        resolve({
          success: false,
          message: 'The transaction was cancelled by the user.'
        });
      }
    }, 4500);
  });
};

/**
 * Production wrapper:
 * If a backend adapter is provided, use it. Otherwise fall back to demo simulation.
 */
export const createMpesaClient = (backend?: MpesaBackendAdapter) => {
  return {
    sendStkRequest: async (phone: string, amount: number, accountRef: string) => {
      if (backend) return backend.createStkPush({ phone: formatPhoneForApi(phone), amount, accountRef });
      return sendStkRequest(phone, amount);
    },
    checkTransactionStatus: async (checkoutRequestId: string) => {
      if (backend) return backend.checkStkStatus({ checkoutRequestId });
      return checkTransactionStatus(checkoutRequestId);
    }
  };
};
