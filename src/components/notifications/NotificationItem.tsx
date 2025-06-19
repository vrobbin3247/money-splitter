import { useState, useMemo, useCallback } from "react";
import type { NotificationWithRelations } from "../notifications/types";
import { markAsRead } from "../../services/notifications";

interface NotificationItemProps {
  notification: NotificationWithRelations;
  onMarkAsRead?: (id: string) => void;
  showAvatar?: boolean;
  compact?: boolean;
}

const NOTIFICATION_ICONS = {
  expense_created: "💰",
  individual_settlement: "✅",
  payment_reminder: "⏰",
  group_created: "👥",
  group_updated: "📝",
  user_joined: "🎉",
  default: "🔔",
} as const;

export default function NotificationItem({
  notification,
  onMarkAsRead,
  showAvatar = true,
  compact = false,
}: NotificationItemProps) {
  const [isMarkingAsRead, setIsMarkingAsRead] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMarkAsRead = useCallback(async () => {
    if (isMarkingAsRead) return;

    setIsMarkingAsRead(true);
    setError(null);

    try {
      await markAsRead(notification.id);
      onMarkAsRead?.(notification.id);
    } catch (err) {
      setError("Failed to mark as read");
      console.error("Error marking notification as read:", err);
    } finally {
      setIsMarkingAsRead(false);
    }
  }, [notification.id, onMarkAsRead, isMarkingAsRead]);

  const formatDate = useMemo(() => {
    if (!notification.created_at) return "";
    try {
      const date = new Date(notification.created_at);
      const now = new Date();
      const secondsAgo = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (secondsAgo < 0) return "just now";
      if (secondsAgo < 60)
        return secondsAgo <= 1 ? "just now" : `${secondsAgo}s ago`;
      if (secondsAgo < 3600) {
        const minutes = Math.floor(secondsAgo / 60);
        return `${minutes}m ago`;
      }
      if (secondsAgo < 86400) {
        const hours = Math.floor(secondsAgo / 3600);
        return `${hours}h ago`;
      }
      if (secondsAgo < 604800) {
        // Less than 1 week
        const days = Math.floor(secondsAgo / 86400);
        return `${days}d ago`;
      }

      // For older notifications, show actual date
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
      });
    } catch (e) {
      return "";
    }
  }, [notification.created_at]);

    const getNotificationContent = useMemo(() => {
        const senderName = notification.sender?.name || "Someone";
        const amount = notification.amount
            ? `₹${notification.amount.toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            })}`
            : "";

        switch (notification.type) {
            case "expense_created":
                return {
                    icon: NOTIFICATION_ICONS.expense_created,
                    content: (
                        <>
                            <span className="font-medium text-gray-900">{senderName}</span>
                            <span className="text-gray-700"> added expense </span>
                            <span className="font-semibold text-gray-900">
                                {notification.expense?.title ? `"${notification.expense.title}"` : ""}
                            </span>
                            {notification.expense?.amount && (
                                <span className="text-green-600 font-medium">
                                    {" "}
                                    for {amount}
                                </span>
                            )}
                        </>
                    ),
                };

            case "individual_settlement":
                return {
                    icon: NOTIFICATION_ICONS.individual_settlement,
                    content: (
                        <>
                            <span className="font-medium text-gray-900">{senderName}</span>
                            <span className="text-gray-700"> settled </span>
                            <span className="font-semibold text-green-600">{amount}</span>
                            <span className="text-gray-700"> with you</span>
                        </>
                    ),
                };

            case "payment_reminder":
                return {
                    icon: NOTIFICATION_ICONS.payment_reminder,
                    content: (
                        <span className="text-orange-700">
                            {notification.metadata && typeof notification.metadata === 'object' && 'message' in notification.metadata ? String(notification.metadata.message) : "Payment pending"}
                        </span>
                    ),
                };

            case "group_created":
                return {
                    icon: NOTIFICATION_ICONS.group_created,
                    content: (
                        <>
                            <span className="font-medium text-gray-900">{senderName}</span>
                            <span className="text-gray-700"> created group </span>
                            <span className="font-semibold text-gray-900">
                                {(notification as any).group?.name ? `"${String((notification as any).group.name)}"` : ''}
                            </span>
                        </>
                    ),
                };

            case "user_joined":
                return {
                    icon: NOTIFICATION_ICONS.user_joined,
                    content: (
                        <>
                            <span className="font-medium text-gray-900">{senderName}</span>
                            <span className="text-gray-700"> joined the group</span>
                        </>
                    ),
                };

            default:
                return {
                    icon: NOTIFICATION_ICONS.default,
                    content: (
                        <span className="text-gray-700">
                            {notification.metadata
                                ? typeof notification.metadata === "string"
                                    ? notification.metadata
                                    : (notification.metadata as any).message || "New notification"
                                : "New notification"}
                        </span>
                    ),
                };
        }
    }, [notification]);

  // Get user initials for avatar
  const getUserInitials = useMemo(() => {
    if (!notification.sender?.name) {
      return  "?" ;
    }

    const names = notification.sender.name.trim().split(" ");
    if (names.length === 1) {
      return names[0].charAt(0).toUpperCase();
    }
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  }, [notification.sender]);

    const containerClasses = `
    group transition-all duration-200 border-b border-gray-100 hover:bg-gray-50 cursor-pointer
    ${!notification.is_read ? "bg-blue-50 border-l-4 border-l-blue-500" : ""}
    ${compact ? "p-2" : "p-3"}
  `;

    const avatarClasses = `
    flex-shrink-0 rounded-full flex items-center justify-center text-white font-medium text-sm
    ${compact ? "w-6 h-6 text-xs" : "w-10 h-10"}
    ${!notification.is_read ? "bg-blue-500" : "bg-gray-400"}
  `;

    return (
        <div className={containerClasses} role="listitem">
            <div className="flex items-start gap-3">
                {/* Avatar or Icon */}
                {showAvatar ? (
                    <div className={avatarClasses} title={notification.sender?.name}>
                        {getUserInitials}
                    </div>
                ) : (
                    <span className="flex-shrink-0 text-lg" role="img" aria-hidden="true">
                        {getNotificationContent.icon}
                    </span>
                )}

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className={`text-gray-800 ${compact ? "text-xs" : "text-sm"}`}>
                        {getNotificationContent.content}
                    </div>

                    <div className="flex items-center justify-between mt-1">
                        <time
                            className={`text-gray-500 ${compact ? "text-xs" : "text-xs"}`}
                            dateTime={notification.created_at ? notification.created_at : undefined}
                            title={notification.created_at ? new Date(notification.created_at).toLocaleString() : undefined}
                        >
                            {formatDate}
                        </time>
                    </div>

          {/* Error message */}
          {error && (
            <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <span>⚠️</span>
              {error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {!notification.is_read && (
            <>
              {/* Unread indicator dot */}
              <div
                className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"
                aria-label="Unread notification"
              />

              {/* Mark as read button */}
              <button
                onClick={handleMarkAsRead}
                disabled={isMarkingAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-100 px-2 py-1 rounded transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Mark notification as read"
              >
                {isMarkingAsRead ? "..." : "Mark read"}
              </button>
            </>
          )}
        </div>
            </div>
        </div>
    );
}