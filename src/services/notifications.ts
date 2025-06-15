import { supabase } from "../lib/supabase";

// services/notifications.ts
import type { NotificationType } from "../components/notifications/types";

export const sendNotification = async (
  type: NotificationType,
  recipient_id: string,
  sender_id: string,
  payload?: {
    expense_id?: string;
    settlement_id?: string;
    amount?: number;
    metadata?: Record<string, any>;
  }
) => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          type,
          recipient_id,
          sender_id,
          ...payload,
          is_read: false,
        },
      ])
      .select();

    if (error) throw error;

    // Real-time update
    const channel = supabase.channel(`notifications:${recipient_id}`);
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        channel.send({
          type: "broadcast",
          event: "new_notification",
          payload: data[0],
        });
      }
    });

    return data[0];
  } catch (error) {
    console.error("Notification error:", error);
    // Optional: Add error reporting service call here
    return null;
  }
};

// Additional notification service functions
export const markAsRead = async (notificationId: string) => {
  /* ... */
};

// export const getUnreadCount = async (userId: string) => {
//   /* ... */
// };
