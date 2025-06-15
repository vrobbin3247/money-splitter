import type { Database } from "../../lib/database.types";

export type NotificationType =
  | "expense_created"
  | "expense_updated"
  | "individual_settlement"
  | "balance_settlement"
  | "payment_reminder"
  | "new_roommate"
  | "payment_received";

// 2. Base types from Supabase
type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

// 3. Enhanced type with relationships (exactly as you had it)
export interface NotificationWithRelations
  extends Omit<NotificationRow, "sender_id" | "recipient_id"> {
  sender: Pick<
    Database["public"]["Tables"]["profiles"]["Row"],
    "name" | "upi_id"
  >;
  recipient: Pick<Database["public"]["Tables"]["profiles"]["Row"], "id">;
  expense?: Pick<
    Database["public"]["Tables"]["expenses"]["Row"],
    "title" | "amount"
  >;
  settlement?: Pick<
    Database["public"]["Tables"]["settlements"]["Row"],
    "amount" | "settled_at"
  >;
}

// 4. Real-time payload type (unchanged from your version)
export type RawNotificationPayload = Pick<
  NotificationRow,
  | "id"
  | "type"
  | "recipient_id"
  | "expense_id"
  | "settlement_id"
  | "amount"
  | "is_read"
  | "created_at"
>;
