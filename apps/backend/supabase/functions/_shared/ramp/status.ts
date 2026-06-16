import { RampStatus } from "./types.ts";

/**
 * Map a Transak order/event status string to our internal RampStatus.
 * Pure function — no side effects — so it is trivially unit-testable.
 */
export function mapTransakStatus(status: string): RampStatus {
  switch (status) {
    case "ORDER_CREATED":
    case "AWAITING_PAYMENT_FROM_USER":
      return "created";
    case "PAYMENT_DONE_MARKED_BY_USER":
    case "ORDER_PAYMENT_VERIFYING":
      return "payment_pending";
    case "ORDER_PROCESSING":
    case "CRYPTO_LIQUIDITY_PROVIDER_PENDING":
    case "PROCESSING":
    case "PENDING_DELIVERY_FROM_TRANSAK":
      return "processing";
    case "ORDER_COMPLETED":
    case "COMPLETED":
      return "completed";
    case "ORDER_FAILED":
    case "REFUND_REQUEST_INITIATED":
    case "ORDER_CANCELLED":
    case "CANCELLED":
    case "FAILED":
      return "failed";
    case "ORDER_REFUNDED":
    case "REFUNDED":
      return "refunded";
    case "ORDER_EXPIRED":
    case "EXPIRED":
      return "expired";
    default:
      console.warn(`[mapTransakStatus] Unknown status: ${status}`);
      return "processing";
  }
}
