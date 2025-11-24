/**
 * Service to handle Yookassa Widget integration.
 * Docs: https://yookassa.ru/docs/support/payments/onboarding/integration/cms-module/telegram (User provided)
 * Widget Docs: https://yookassa.ru/en/developers/payment-acceptance/integration-scenarios/widget/quick-start
 */

declare global {
  interface Window {
    YooMoneyCheckoutWidget: any;
  }
}

// Mock backend response type
interface CreatePaymentResponse {
  confirmation_token: string;
  payment_id: string;
}

/**
 * Creates a payment object (Mock implementation).
 * In a real app, this MUST call your backend, which then calls Yookassa API 
 * with your Secret Key to get a confirmation_token.
 */
export const createPayment = async (amount: number, description: string): Promise<CreatePaymentResponse> => {
  console.log(`Creating payment for ${amount} RUB: ${description}`);
  
  // SIMULATION DELAY
  await new Promise(resolve => setTimeout(resolve, 1500));

  // REAL INTEGRATION NOTE:
  // You would fetch('/api/create-payment', { method: 'POST', body: JSON.stringify({ amount }) })
  // and return the token from the response.
  
  // Since we are client-side only, we return a mock token.
  // The real widget will fail with this token, so we will use this to trigger a "Demo Success" in the UI.
  return {
    confirmation_token: "ct-mock-token-for-demo-purposes-" + Date.now(),
    payment_id: "pid_" + Date.now()
  };
};

/**
 * Initializes the Yookassa widget in the specified DOM element.
 */
export const renderPaymentWidget = (
  confirmationToken: string, 
  elementId: string, 
  onSuccess: () => void,
  onError: (err: any) => void
) => {
  if (!window.YooMoneyCheckoutWidget) {
    console.error("Yookassa script not loaded");
    onError(new Error("Payment system not ready"));
    return;
  }

  try {
    const checkout = new window.YooMoneyCheckoutWidget({
      confirmation_token: confirmationToken,
      // return_url: 'https://your-site.com/return', // Optional for widget
      error_callback: (error: any) => {
        console.error("Widget error:", error);
        // onError(error); // Don't trigger onError immediately to keep UI stable for demo
      }
    });

    checkout.render(elementId);
    
    // DEMO HACK: Since the mock token won't actually work with Yookassa servers,
    // we simulate a successful payment event for the user after they "interact" (or just 5s timer for demo).
    // In production, Yookassa handles the flow and redirects or calls webhooks.
    console.log("⚠️ DEMO MODE: Simulating payment success in 5 seconds since we lack a backend...");
    setTimeout(() => {
        onSuccess();
    }, 5000);

  } catch (e) {
    console.error("Failed to render widget:", e);
    onError(e);
  }
};
