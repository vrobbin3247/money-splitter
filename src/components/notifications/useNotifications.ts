import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import type { NotificationWithRelations } from "./types";

export default function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<
    NotificationWithRelations[]
  >([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Declare fetch function outside useEffect so it can be reused
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
          *,
          sender:profiles!notifications_sender_id_fkey(name, upi_id),
          recipient:profiles!notifications_recipient_id_fkey(id),
          expense:expenses(title, amount),
          settlement:settlements(amount, settled_at)
        `
        )
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount(data?.filter((n) => !n.is_read).length || 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load notifications"
      );
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotifications();

    // In your real-time handler:
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${userId}`,
        },
        async (payload) => {
          const { data: fullNotification } = await supabase
            .from("notifications")
            .select(
              `
          *,
          sender:profiles!notifications_sender_id_fkey(name, upi_id),
          recipient:profiles!notifications_recipient_id_fkey(id),
          expense:expenses(title, amount),
          settlement:settlements(amount, settled_at)
        `
            )
            .eq("id", payload.new.id)
            .single();

          if (fullNotification) {
            setNotifications((prev) => [fullNotification, ...prev]);
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);

      if (error) throw error;
    } catch (err) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: false } : n
        )
      );
      setUnreadCount((prev) => prev + 1);
      console.error("Mark as read failed:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("recipient_id", userId)
        .eq("is_read", false);

      if (error) throw error;
    } catch (err) {
      // Now we can properly use fetchNotifications here
      fetchNotifications();
      console.error("Mark all read failed:", err);
    }
  };

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch: fetchNotifications,
  };
}
