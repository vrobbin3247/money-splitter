// src/components/NotificationDropdown.tsx
import { useState, useRef, useCallback, useEffect } from "react";
import { FaBell, FaTimes } from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import useNotifications from "./useNotifications";
import NotificationItem from "./NotificationItem";
import type { NotificationWithRelations } from "./types";

interface NotificationDropdownProps {
  userId: string;
  className?: string;
  maxHeight?: string;
  position?: "left" | "right";
}

const NotificationDropdown = ({
  userId,
  className = "",
  maxHeight = "calc(100vh-200px)",
  position = "right",
}: NotificationDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
  } = useNotifications(userId);

  // Click outside hook implementation
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  const handleBellClick = useCallback(() => {
    setIsOpen((prev) => !prev);

    // Mark all as read when opening if there are unread notifications
    if (!isOpen && unreadCount > 0) {
      markAllAsRead();
    }
  }, [isOpen, unreadCount, markAllAsRead]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleMarkAllAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }, [markAllAsRead]);

  const handleRetry = useCallback(() => {
    if (typeof refetch === "function") {
      refetch();
    }
  }, [refetch]);

  // Memoized notification count display
  const notificationBadge = unreadCount > 0 && (
    <span
      className="absolute -top-1 -right-1 min-w-[1.25rem] h-5 bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1"
      aria-label={`${unreadCount} unread notifications`}
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );

  const positionClasses = position === "left" ? "left-0" : "right-0";

  return (
    <div className={`relative ${className}`}>
      <button
        ref={buttonRef}
        onClick={handleBellClick}
        aria-label={`Notifications${
          unreadCount > 0 ? ` (${unreadCount} unread)` : ""
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="p-2 rounded-full transition-all duration-200 hover:bg-gray-100 active:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 relative group"
      >
        <FaBell
          className={`w-5 h-5 transition-colors duration-200 ${
            unreadCount > 0 ? "text-blue-600" : "text-gray-700"
          } group-hover:text-blue-600`}
        />
        {notificationBadge}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
            ref={dropdownRef}
            role="dialog"
            aria-label="Notifications panel"
            className={`absolute ${positionClasses} mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden`}
          >
            {/* Header */}
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-white sticky top-0 z-10">
              <h3
                className="font-semibold text-gray-900"
                id="notifications-heading"
              >
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({unreadCount} new)
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 transition-colors duration-200 px-2 py-1 rounded hover:bg-blue-50"
                    aria-label="Mark all notifications as read"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={handleClose}
                  className="text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 transition-colors duration-200"
                  aria-label="Close notifications"
                >
                  <FaTimes className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div
              className="overflow-y-auto"
              style={{ maxHeight }}
              role="region"
              aria-labelledby="notifications-heading"
            >
              {isLoading ? (
                <div
                  className="p-4 space-y-3"
                  aria-label="Loading notifications"
                >
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="flex space-x-3">
                        <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <div className="text-red-500 mb-2">
                    Failed to load notifications
                  </div>
                  <button
                    onClick={handleRetry}
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <FaBell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No notifications yet</p>
                  <p className="text-sm text-gray-400 mt-1">
                    We'll notify you when something happens
                  </p>
                </div>
              ) : (
                <div role="list" aria-label="Notification list">
                  {notifications.map(
                    (notification: NotificationWithRelations) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={markAsRead}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationDropdown;
