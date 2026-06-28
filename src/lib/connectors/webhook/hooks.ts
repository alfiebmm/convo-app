import { deliverPendingWebhooks } from "./deliver";
import { enqueueWebhookDelivery, type WebhookPayload } from "./outbox";
import type { WebhookEvent } from "./settings";

interface FireWebhookEventInput {
  tenantId: string;
  caseId: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  idempotencyKey: string;
}

export function fireWebhookEvent(input: FireWebhookEventInput): void {
  void enqueueWebhookDelivery(input)
    .then((result) => {
      if (result.status === "enqueued" || result.status === "skipped-duplicate") {
        return deliverPendingWebhooks({ tenantId: input.tenantId, limit: 5 });
      }
      return undefined;
    })
    .catch((error) => {
      console.error("Webhook event hook failed", error);
    });
}
