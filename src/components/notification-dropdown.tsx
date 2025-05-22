"use client";

import { useEffect, useState, useRef } from "react";
import { FaBell } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";
import { useNotification } from "@/hooks/notifications/useNotification";
import { toast } from "react-hot-toast";

interface Notification {
  id: string;
  content: string;
  read: boolean;
  created_at: string;
  type: string;
  data?: {
    userId?: string;
    groupId?: string;
    senderId?: string;
  };
}

interface NotificationDropdownProps {
  className?: string; // Allow custom positioning
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Use the hook instead of direct service call
  const {
    loading: isLoading,
    error,
    notifications,
    unreadCount,
    pagination,
    getNotifications,
    loadMoreNotifications,
    markAllAsRead,
    getUnreadCount,
    markAsRead,
  } = useNotification();

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  // Handle notification click - marks as read and potentially navigates
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await markAsRead(notification.id);
        toast.success("Notification marked as read");

        // Handle navigation based on notification type
        if (
          notification.type === "friend_request" &&
          notification.data?.userId
        ) {
          // Navigate to friends page - implement using Next.js router in a real app
          window.location.href = "/chat/friends";
        } else if (
          notification.type === "group_invitation" &&
          notification.data?.groupId
        ) {
          window.location.href = `/chat/groups/${notification.data.groupId}`;
        } else if (
          notification.type === "new_message" &&
          notification.data?.senderId
        ) {
          window.location.href = `/chat/messages/${notification.data.senderId}`;
        }
      } catch (error: any) {
        console.error("Error marking notification as read:", error);
        toast.error(error.message || "Failed to mark notification as read");
      }
    }
  };

  // Mark all as read handler
  const handleMarkAllAsRead = async () => {
    try {
      await markAllAsRead();
      toast.success("All notifications marked as read");
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      toast.error(error.message || "Failed to mark all notifications as read");
    }
  };

  // Load more notifications
  const handleLoadMore = async () => {
    if (isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      await loadMoreNotifications();
    } catch (error: any) {
      console.error("Error loading more notifications:", error);
      toast.error(error.message || "Failed to load more notifications");
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    getUnreadCount().catch((err) => {
      console.error("Failed to fetch unread count:", err);
    });

    // Set up periodic refresh of unread count
    const interval = setInterval(() => {
      getUnreadCount().catch((err) => {
        console.error("Failed to update unread count:", err);
      });
    }, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  // Load notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      console.log("Notification dropdown opened, fetching notifications...");

      getNotifications(1, 10)
        .then((response) => {
          console.log("Notifications fetched successfully:", response);
        })
        .catch((err) => {
          console.error("Failed to fetch notifications:", err);

          // Only show error toast for actual errors, not for empty results
          if (
            err.message &&
            err.message !== "Invalid response format from server"
          ) {
            toast.error(`Error loading notifications: ${err.message}`);
          } else {
            // Handle the case where notifications might be empty but not an error
            console.warn("No notifications found or empty response format");
          }
        });
    }
  }, [isOpen]);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-10 h-10 rounded-full text-white bg-gray-700 hover:bg-gray-600 transition-colors relative"
        aria-label="Notifications"
      >
        <FaBell className="text-lg" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-2 -right-10 w-80 bg-white rounded-md shadow-lg py-1 text-gray-800">
          <div className="px-4 py-2 border-b flex justify-between items-center">
            <h3 className="font-semibold">Notifications</h3>
            {notifications.length > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center items-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-500"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500">
                No notifications
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    !notification.read ? "bg-blue-50" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex justify-between">
                    <div className="flex-1">
                      <p className="text-sm line-clamp-2">
                        {notification.content}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full mt-1"></div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {pagination.has_more_pages && (
            <div className="px-4 py-2 text-center border-t">
              <button
                onClick={handleLoadMore}
                className="text-sm text-blue-500 hover:text-blue-700"
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
