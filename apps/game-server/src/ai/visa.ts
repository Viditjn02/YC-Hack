/**
 * Visa Intelligent Commerce (VIC) MCP client.
 * Provides tokenized payment credentials for autonomous agent purchases.
 *
 * Gracefully disabled if VISA_VIC_API_KEY is not set.
 * Uses the Visa MCP server at sandbox.mcp.visa.com (configurable via VISA_MCP_BASE_URL).
 */
import { log } from '../logger.js';

const VISA_VIC_API_KEY = process.env['VISA_VIC_API_KEY'];
const VISA_MCP_BASE_URL = process.env['VISA_MCP_BASE_URL'] ?? 'https://sandbox.mcp.visa.com';

// Dynamic import — the @visa/mcp-client package is ESM and linked locally.
// We only import if credentials are configured.
let visaClient: {
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  close: () => Promise<void>;
} | null = null;

let visaReady = false;

async function initVisaClient() {
  if (!VISA_VIC_API_KEY) {
    log.warn('VISA_VIC_API_KEY not set — Visa MCP tools disabled');
    return;
  }

  try {
    // @ts-expect-error — @visa/mcp-client is optional (vendor/visa-mcp). Build succeeds without it.
    const { createVisaMcpClient } = await import('@visa/mcp-client');
    visaClient = await createVisaMcpClient();
    visaReady = true;
    log.info(`Visa MCP client initialized (${VISA_MCP_BASE_URL})`);
  } catch (err) {
    log.error('Failed to initialize Visa MCP client:', err);
    visaReady = false;
  }
}

// Fire-and-forget init at module load
initVisaClient().catch(() => {});

/** Check if Visa MCP is available. */
export function isVisaReady(): boolean {
  return visaReady && visaClient !== null;
}

/**
 * Enroll a payment card in the VIC system.
 * One-time setup per card.
 */
export async function enrollCard(params: {
  consumerId: string;
  enrollmentReferenceId: string;
  email: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!visaClient) return { success: false, error: 'Visa MCP not configured' };

  try {
    await visaClient.callTool('enroll-card', {
      clientReferenceId: crypto.randomUUID(),
      consumer: {
        consumerId: params.consumerId,
        countryCode: 'US',
        languageCode: 'en',
        consumerIdentity: {
          identityType: 'EMAIL_ADDRESS',
          identityValue: params.email,
          identityProvider: 'PARTNER',
        },
      },
      enrollmentReferenceData: {
        enrollmentReferenceId: params.enrollmentReferenceId,
        enrollmentReferenceType: 'TOKEN_REFERENCE_ID',
        enrollmentReferenceProvider: 'VTS',
      },
    });
    return { success: true };
  } catch (err) {
    log.error('Visa enrollCard failed:', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Create a purchase instruction (mandate) for a specific merchant and amount.
 * Returns an instructionId used to retrieve credentials.
 */
export async function createPurchaseInstruction(params: {
  consumerId: string;
  tokenId: string;
  merchantName: string;
  merchantUrl: string;
  amount: number;
  currency?: string;
  description: string;
}): Promise<{ instructionId?: string; error?: string }> {
  if (!visaClient) return { error: 'Visa MCP not configured' };

  try {
    const mandateId = crypto.randomUUID();
    const oneYearFromNow = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;

    const result = await visaClient.callTool('initiate-purchase-instruction', {
      clientReferenceId: crypto.randomUUID(),
      consumerId: params.consumerId,
      tokenId: params.tokenId,
      mandates: [{
        mandateId,
        preferredMerchantName: params.merchantName,
        declineThreshold: {
          amount: String(params.amount),
          currencyCode: params.currency ?? 'USD',
        },
        effectiveUntilTime: String(oneYearFromNow),
        quantity: '1',
        description: params.description,
      }],
      consumerPrompt: `Purchase: ${params.description}`,
    }) as { data?: { instructionId?: string } };

    const instructionId = (result as Record<string, unknown>)?.['data']
      ? ((result as Record<string, unknown>)['data'] as Record<string, unknown>)?.['instructionId'] as string | undefined
      : undefined;

    return { instructionId: instructionId ?? mandateId };
  } catch (err) {
    log.error('Visa createPurchaseInstruction failed:', err);
    return { error: String(err) };
  }
}

/**
 * Retrieve tokenized payment credentials for a purchase.
 * These credentials can be used at the merchant's checkout.
 */
export async function getTransactionCredentials(params: {
  tokenId: string;
  instructionId: string;
  amount: number;
  currency?: string;
  merchantName: string;
  merchantUrl: string;
  shippingAddress?: {
    line1: string;
    city: string;
    state: string;
    zip: string;
    countryCode?: string;
    contactName: string;
    contactEmail: string;
  };
}): Promise<{ credentials?: unknown; error?: string }> {
  if (!visaClient) return { error: 'Visa MCP not configured' };

  try {
    const transactionReferenceId = crypto.randomUUID();
    const result = await visaClient.callTool('get-transaction-credentials', {
      clientReferenceId: crypto.randomUUID(),
      tokenId: params.tokenId,
      instructionId: params.instructionId,
      transactionData: [{
        transactionType: 'PURCHASE',
        transactionReferenceId,
        transactionAmount: {
          transactionCurrencyCode: params.currency ?? 'USD',
          transactionAmount: String(params.amount),
        },
        merchantName: params.merchantName,
        merchantUrl: params.merchantUrl,
        merchantCountryCode: 'US',
        ...(params.shippingAddress ? {
          shippingAddress: {
            addressId: crypto.randomUUID(),
            line1: params.shippingAddress.line1,
            city: params.shippingAddress.city,
            state: params.shippingAddress.state,
            zip: params.shippingAddress.zip,
            countryCode: params.shippingAddress.countryCode ?? 'US',
            deliveryContactDetails: {
              contactFullName: params.shippingAddress.contactName,
              contactEmailAddress: params.shippingAddress.contactEmail,
            },
          },
        } : {}),
      }],
    });

    return { credentials: result };
  } catch (err) {
    log.error('Visa getTransactionCredentials failed:', err);
    return { error: String(err) };
  }
}

/**
 * Confirm a completed transaction back to Visa.
 */
export async function confirmTransaction(params: {
  instructionId: string;
  transactionReferenceId: string;
  amount: number;
  currency?: string;
  merchantName: string;
  status: 'APPROVED' | 'DECLINED' | 'FAILED';
  orderId: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!visaClient) return { success: false, error: 'Visa MCP not configured' };

  try {
    await visaClient.callTool('confirmations', {
      clientReferenceId: crypto.randomUUID(),
      instructionId: params.instructionId,
      confirmationData: [{
        transactionReferenceId: params.transactionReferenceId,
        paymentConfirmationData: {
          transactionType: 'PURCHASE',
          transactionStatus: params.status,
          responseCode: params.status === 'APPROVED' ? '00' : '05',
          authorizationCode: `AUTH-${crypto.randomUUID().slice(0, 8)}`,
          transactionAmount: {
            transactionAmount: String(params.amount),
            transactionCurrencyCode: params.currency ?? 'USD',
          },
          cardEntryMode: 'ECOMMERCE',
        },
        orderData: {
          orderId: params.orderId,
          orderStatus: params.status === 'APPROVED' ? 'COMPLETED' : 'FAILED',
          transactionAmount: {
            transactionAmount: String(params.amount),
            transactionCurrencyCode: params.currency ?? 'USD',
          },
        },
        merchantData: { merchantName: params.merchantName },
      }],
    });

    return { success: true };
  } catch (err) {
    log.error('Visa confirmTransaction failed:', err);
    return { success: false, error: String(err) };
  }
}
