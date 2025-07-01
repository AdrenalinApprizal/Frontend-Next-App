"use client";

import { useEffect, useState, useRef } from "react";
import { FaBell } from "react-icons/fa";
import { formatDistanceToNow } from "date-fns";
import {
  useNotification,
  type Notification,
} from "@/hooks/notifications/useNotification";
import { toast } from "react-hot-toast";

interface NotificationDropdownProps {
  className?: string; // Allow custom positioning
}

interface UserCache {
  [userId: string]: string; // userId -> username mapping
}

export function NotificationDropdown({ className }: NotificationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [userCache, setUserCache] = useState<UserCache>({}); // Cache untuk username
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set()); // Track loading users
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

  // Helper function to extract username from notification body
  const extractUsernameFromBody = (body: string): string | null => {
    // Backend format: "New message from {username}" or "New group message from {username}"
    const match = body.match(/New (?:group )?message from (.+)$/i);
    return match ? match[1] : null;
  };

  // Function to fetch username from user ID
  const fetchUsername = async (userId: string): Promise<string> => {
    // Check cache first
    if (userCache[userId]) {
      return userCache[userId];
    }

    // Check if already loading this user
    if (loadingUsers.has(userId)) {
      return `user-${userId.substring(0, 8)}...`; // Temporary display while loading
    }

    try {
      setLoadingUsers((prev) => new Set(prev).add(userId));

      // Call API to get user details
      const response = await fetch(`/api/proxy/users/${userId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch user: ${response.status}`);
      }

      const userData = await response.json();

      // Extract username from various possible fields
      const username =
        userData.username ||
        userData.name ||
        userData.display_name ||
        `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
        userData.email?.split("@")[0] ||
        `User-${userId.substring(0, 8)}`;

      // Cache the result
      setUserCache((prev) => ({
        ...prev,
        [userId]: username,
      }));

      return username;
    } catch (error) {
      console.error(`Error fetching username for ${userId}:`, error);

      // Cache a fallback username to avoid repeated failed requests
      const fallbackUsername = `User-${userId.substring(0, 8)}`;
      setUserCache((prev) => ({
        ...prev,
        [userId]: fallbackUsername,
      }));

      return fallbackUsername;
    } finally {
      setLoadingUsers((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  // Helper function to get display content for notification
  const getNotificationDisplayContent = (
    notification: Notification
  ): string => {
    console.log("[NotificationDropdown] Processing notification:", {
      id: notification.id,
      type: notification.type,
      body: notification.body,
      title: notification.title,
      content: notification.content,
      data: notification.data,
    });

    // Prioritize body from backend if available (contains username)
    if (notification.body) {
      console.log("[NotificationDropdown] Using body:", notification.body);
      return notification.body;
    }

    // Fallback to content field
    if (notification.content) {
      console.log(
        "[NotificationDropdown] Using content:",
        notification.content
      );
      return notification.content;
    }

    // Generate content based on type and data with username resolution
    if (notification.type === "message" && notification.data?.sender_id) {
      const senderId = notification.data.sender_id;

      // PRIORITY 1: Check if sender_username is available in data object
      if (notification.data.sender_username) {
        const usernameContent = `New message from ${notification.data.sender_username}`;
        console.log(
          "[NotificationDropdown] Using sender_username from data:",
          usernameContent
        );
        return usernameContent;
      }

      // PRIORITY 2: Check if we have username in cache
      if (userCache[senderId]) {
        const cachedContent = `New message from ${userCache[senderId]}`;
        console.log(
          "[NotificationDropdown] Using cached username:",
          cachedContent
        );
        return cachedContent;
      }

      // PRIORITY 3: If loading, show loading state
      if (loadingUsers.has(senderId)) {
        return `New message from user (loading...)`;
      }

      // PRIORITY 4: Show user ID as fallback (this will trigger username fetch)
      const fallbackContent = `New message from user ${senderId.substring(
        0,
        8
      )}...`;
      console.log(
        "[NotificationDropdown] Using fallback with user ID:",
        fallbackContent
      );

      // Trigger username fetch in background (don't await to avoid blocking UI)
      fetchUsername(senderId).then((username) => {
        // This will trigger a re-render when username is cached
        console.log(
          `[NotificationDropdown] Fetched username for ${senderId}: ${username}`
        );
      });

      return fallbackContent;
    }

    console.log("[NotificationDropdown] Using default content");
    return "New notification";
  };

  // Helper function to get sender username
  const getSenderUsername = (notification: Notification): string | null => {
    // Try to extract from body first (backend provides this)
    if (notification.body) {
      const username = extractUsernameFromBody(notification.body);
      if (username) return username;
    }

    // Could add logic here to fetch username from sender_id if needed
    // For now, return null if we can't extract it
    return null;
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
          (notification.data?.userId || notification.data?.sender_id)
        ) {
          // Navigate to friends page - implement using Next.js router in a real app
          window.location.href = "/chat/friends";
        } else if (
          notification.type === "group_invitation" &&
          notification.data?.groupId
        ) {
          window.location.href = `/chat/groups/${notification.data.groupId}`;
        } else if (
          (notification.type === "message" ||
            notification.type === "new_message") &&
          (notification.data?.senderId || notification.data?.sender_id)
        ) {
          // Use sender_id from backend or fallback to senderId
          const senderId =
            notification.data.sender_id || notification.data.senderId;
          if (notification.data?.groupId) {
            // Group message - navigate to group chat
            window.location.href = `/chat/groups/${notification.data.groupId}`;
          } else {
            // Direct message - navigate to private chat
            window.location.href = `/chat/messages/${senderId}`;
          }
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

  // Auto-fetch usernames for notifications that have sender_id but no body or sender_username
  useEffect(() => {
    const notificationsNeedingUsernames = notifications.filter(
      (notification) =>
        !notification.body &&
        notification.data?.sender_id &&
        !notification.data?.sender_username && // Don't fetch if sender_username is already available
        !userCache[notification.data.sender_id] &&
        !loadingUsers.has(notification.data.sender_id)
    );

    if (notificationsNeedingUsernames.length > 0) {
      console.log(
        "[NotificationDropdown] Auto-fetching usernames for notifications:",
        notificationsNeedingUsernames.map((n) => n.data?.sender_id)
      );

      // Batch fetch usernames
      notificationsNeedingUsernames.forEach((notification) => {
        if (notification.data?.sender_id) {
          fetchUsername(notification.data.sender_id).catch((err) => {
            console.error("Failed to fetch username:", err);
          });
        }
      });
    }
  }, [notifications, userCache, loadingUsers]);

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
                      <p className="text-sm line-clamp-2 font-medium">
                        {getNotificationDisplayContent(notification)}
                        {/* Show loading indicator for username fetch */}
                        {notification.data?.sender_id &&
                          loadingUsers.has(notification.data.sender_id) && (
                            <span className="inline-block ml-2">
                              <div className="animate-spin rounded-full h-3 w-3 border border-gray-400 border-t-transparent inline-block"></div>
                            </span>
                          )}
                      </p>
                      {/* Show notification title if different from body */}
                      {notification.title &&
                        notification.title !== notification.body && (
                          <p className="text-xs text-gray-600 mt-1">
                            {notification.title}
                          </p>
                        )}
                      
                      {/* Show sender info if available */}
                      {notification.data?.sender_id &&
                        (notification.data?.sender_username ||
                          userCache[notification.data.sender_id]) && (
                          <p className="text-xs text-green-600 mt-1">
                            From:{" "}
                            {notification.data?.sender_username ||
                              userCache[notification.data.sender_id]}
                          </p>
                        )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatTimestamp(notification.created_at)}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="h-2 w-2 bg-blue-500 rounded-full mt-1 flex-shrink-0"></div>
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
