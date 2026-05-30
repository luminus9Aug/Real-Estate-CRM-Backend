export interface RazorpayOrderOptions {
  amount: number;
  currency: string;
  receipt: string;
  notes: Record<string, string | number | boolean | undefined>;
}

export interface RazorpayWebhookPayload {
  id: string;
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: Record<string, unknown>;
    };
    subscription?: {
      entity: Record<string, unknown>;
    };
    order?: {
      entity: Record<string, unknown>;
    };
  };
  created_at: number;
}
