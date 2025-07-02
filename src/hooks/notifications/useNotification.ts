import { useState } from "react";
import { useSession } from "next-auth/react";

// Define types
export interface Notification {
  id: string;
  user_id: string;
  type: string;
  content: string;
  body?: string; // Backend provides this with sender username
  title?: string; // Backend provides this too
  related_to?: string;
  read: boolean;
  created_at: string;
  data?: {
    userId?: string;
    groupId?: string;
    senderId?: string;
    sender_id?: string; // Backend uses snake_case
    sender_username?: string; // Backend provides sender username
    message_id?: string;
    [key: string]: any; // Allow other properties
  };
}

export interface NotificationPagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  items_per_page: number;
  has_more_pages: boolean;
}

export interface NotificationResponse {
  notifications: Notification[];
  pagination: NotificationPagination;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  total_count: number;
  page: number;
  limit: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const useNotification = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState<NotificationPagination>({
    current_page: 1,
    total_pages: 1,
    total_count: 0,
    items_per_page: 10,
    has_more_pages: false,
  });

  // API endpoint - ensure it ends without a trailing slash
  const API_ENDPOINT = "/api/proxy/notifications";

  // Helper function for API calls with fixed path construction
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    try {
      const defaultOptions: RequestInit = {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
      };

      // Add authorization header if session has access_token
      if (session?.access_token) {
        defaultOptions.headers = {
          ...defaultOptions.headers,
          Authorization: `Bearer ${session.access_token}`,
        };
      }

      // Merge default options with provided options
      const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...options.headers,
        },
      };

      // Fix path construction - ensure we don't get double slashes
      let url;
      if (endpoint.startsWith("http")) {
        url = endpoint;
      } else {
        // Handle endpoint paths correctly, ensuring proper slash handling
        const endpointPath = endpoint.startsWith("/")
          ? endpoint.slice(1)
          : endpoint;
        url = `${API_ENDPOINT}/${endpointPath}`.replace(/\/+/g, "/");
      }


      const response = await fetch(url, mergedOptions);

      // Handle different response formats
      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorMessage: string;

        try {
          if (contentType && contentType.includes("application/json")) {
            const errorData = await response.json();
            errorMessage =
              errorData.message ||
              `Error ${response.status}: ${response.statusText}`;
          } else {
            const errorText = await response.text();
            errorMessage =
              errorText || `Error ${response.status}: ${response.statusText}`;
          }
        } catch (parseError) {
          errorMessage = `Error ${response.status}: ${response.statusText}`;
        }

        throw new Error(errorMessage);
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        return await response.json();
      }

      return await response.text();
    } catch (err: any) {
      console.error(`API call failed for ${endpoint}:`, err);
      throw err;
    }
  };

  /**
   * Get notifications with pagination
   */
  const getNotifications = async (
    page: number = 1,
    limit: number = 20
  ): Promise<NotificationResponse> => {
    setLoading(true);
    setError(null);

    try {
      const offset = (page - 1) * limit;
      const data = await apiCall(`?offset=${offset}&limit=${limit}`, {
        method: "GET",
      });


      // Handle different response formats
      let notificationsData: Notification[] = [];
      let paginationData: NotificationPagination = {
        current_page: page,
        total_pages: 1,
        total_count: 0,
        items_per_page: limit,
        has_more_pages: false,
      };

      if (data && Array.isArray(data)) {
        // Handle case where API returns an array directly
        notificationsData = data.map((notification: any) => ({
          ...notification,
          id: notification.id || notification._id || `temp-${Date.now()}`,
          content:
            notification.content || notification.message || "New notification",
          read: notification.read || false,
          created_at:
            notification.created_at ||
            notification.createdAt ||
            new Date().toISOString(),
          type: notification.type || "default",
        }));

        paginationData = {
          current_page: page,
          total_pages: data.length > 0 ? Math.ceil(data.length / limit) : 1,
          total_count: data.length,
          items_per_page: limit,
          has_more_pages: data.length >= limit,
        };
      }
      // Handle case where API returns object with notifications array
      else if (data && (data.notifications || data.data || data.results)) {
        const notificationsArray =
          data.notifications || data.data || data.results || [];

        notificationsData = notificationsArray.map((notification: any) => ({
          ...notification,
          id: notification.id || notification._id || `temp-${Date.now()}`,
          content:
            notification.content || notification.message || "New notification",
          read: notification.read || false,
          created_at:
            notification.created_at ||
            notification.createdAt ||
            new Date().toISOString(),
          type: notification.type || "default",
        }));

        // Use pagination if provided, or create default
        if (data.pagination) {
          paginationData = data.pagination;
        } else if (data.meta) {
          paginationData = {
            current_page: data.meta.current_page || data.meta.page || page,
            total_pages: data.meta.total_pages || data.meta.pageCount || 1,
            total_count:
              data.meta.total_count ||
              data.meta.totalCount ||
              notificationsArray.length,
            items_per_page:
              data.meta.per_page || data.meta.itemsPerPage || limit,
            has_more_pages:
              data.meta.has_more_pages || data.meta.hasNextPage || false,
          };
        } else {
          // Default pagination
          paginationData = {
            current_page: page,
            total_pages:
              notificationsArray.length > 0
                ? Math.ceil(notificationsArray.length / limit)
                : 1,
            total_count: notificationsArray.length,
            items_per_page: limit,
            has_more_pages: notificationsArray.length >= limit,
          };
        }
      }

      // Update state
      setNotifications(notificationsData);
      setPagination(paginationData);
      setLoading(false);

      return {
        notifications: notificationsData,
        pagination: paginationData,
      };
    } catch (err: any) {
      setError(`Failed to get notifications: ${err.message}`);
      console.error("Error fetching notifications:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Load more notifications (for pagination)
   */
  const loadMoreNotifications =
    async (): Promise<NotificationResponse | null> => {
      if (!pagination.has_more_pages) {
        return null;
      }

      try {
        const nextPage = pagination.current_page + 1;
        const response = await getNotifications(
          nextPage,
          pagination.items_per_page
        );

        // Append new notifications to existing ones
        if (response && response.notifications) {
          setNotifications((prevNotifications) => [
            ...prevNotifications,
            ...response.notifications,
          ]);
        }

        return response;
      } catch (err) {
        console.error("Error loading more notifications:", err);
        throw err;
      }
    };

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`/read-all`, {
        method: "PUT",
        body: JSON.stringify({}),
      });

      // Update notifications state to reflect that all are read
      if (notifications.length > 0) {
        setNotifications((prevNotifications) =>
          prevNotifications.map((notification) => ({
            ...notification,
            read: true,
          }))
        );
      }

      // Reset unread count
      setUnreadCount(0);

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to mark all notifications as read: ${err.message}`);
      console.error("Error marking all notifications as read:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get unread notification count for the current user
   */
  const getUnreadCount = async (): Promise<UnreadCountResponse> => {
    setError(null);

    try {
      // Using "/unread-count" with leading slash to ensure proper URL construction
      const response = await apiCall("/unread-count", {
        method: "GET",
      });


      // Handle various response formats
      if (response && typeof response.count === "number") {
        setUnreadCount(response.count);
        return response;
      } else if (response && typeof response === "object") {
        // Try to find a count property with a different name
        const possibleCountProps = ["count", "unread_count", "total", "unread"];
        for (const prop of possibleCountProps) {
          if (typeof response[prop] === "number") {
            const count = response[prop];
            setUnreadCount(count);
            return { count };
          }
        }

        console.warn(
          "[Notifications] Invalid unread count response:",
          response
        );
        // Keep the previous value if response is invalid
        return { count: unreadCount };
      } else if (typeof response === "number") {
        // Handle case where API returns just the number
        setUnreadCount(response);
        return { count: response };
      } else {
        console.warn("[Notifications] Unexpected response format:", response);
        return { count: unreadCount };
      }
    } catch (err: any) {
      // For errors fetching unread count, we'll use 0 as default but still record the error
      setError(`Failed to get unread notification count: ${err.message}`);
      console.error("[Notifications] Error fetching unread count:", err);

      // Return a valid response with count 0 to prevent UI errors
      return { count: 0 };
    }
  };

  /**
   * Mark a specific notification as read
   */
  const markAsRead = async (notificationId: string) => {
    if (!notificationId) {
      console.error("Invalid notification ID provided");
      throw new Error("Invalid notification ID");
    }

    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`/${notificationId}/read`, {
        method: "PUT",
        body: JSON.stringify({}),
      });

      // Update the notification in the state
      setNotifications((prevNotifications) =>
        prevNotifications.map((notification) =>
          notification.id === notificationId
            ? { ...notification, read: true }
            : notification
        )
      );

      // Update unread count
      if (unreadCount > 0) {
        setUnreadCount((prevCount) => prevCount - 1);
      }

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to mark notification as read: ${err.message}`);
      console.error("Error marking notification as read:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Check the notification service health
   */
  const checkHealth = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiCall(`/health`, {
        method: "GET",
      });

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to check notification service health: ${err.message}`);
      console.error("Error checking notification service health:", err);
      setLoading(false);
      throw err;
    }
  };

  return {
    // State
    loading,
    error,
    notifications,
    unreadCount,
    pagination,

    // Actions
    getNotifications,
    loadMoreNotifications,
    markAllAsRead,
    getUnreadCount,
    markAsRead,
    checkHealth,
  };
};
