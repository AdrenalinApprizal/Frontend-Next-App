import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

// Define types
export type PresenceStatus = "online" | "offline" | "busy" | "away";

interface UserPresenceData {
  status: PresenceStatus;
  last_active: string;
  user_id: string; // Added to match the Vue example
}

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
  status?: number;
  statusText?: string;
}

interface StatusUpdateRequest {
  device_id: string;
  status: PresenceStatus;
}

interface UsePresenceOptions {
  autoConnect?: boolean;
}

// Updated configuration - define the base path for presence API
const PRESENCE_PATH = "/api/proxy/presence"; // Using your app's proxy

export function usePresence(
  options: UsePresenceOptions = { autoConnect: true }
) {
  const { data: session } = useSession();

  // State
  const [currentStatus, setCurrentStatus] = useState<PresenceStatus>("online"); // Changed default to online
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [userStatuses, setUserStatuses] = useState<
    Map<string, UserPresenceData>
  >(new Map());
  const [deviceId, setDeviceId] = useState<string>("");

  // Refs
  const wsConnectionRef = useRef<WebSocket | null>(null);

  /**
   * Ensure device ID is generated if not already set
   */
  const ensureDeviceId = useCallback(() => {
    if (!deviceId) {
      // Only generate device ID on client side
      if (typeof window !== "undefined") {
        // Generate a simple device ID based on browser/user agent and current time
        const userAgent = navigator?.userAgent || "unknown";
        const newDeviceId = `web-${userAgent
          .substring(0, 10)
          .replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;
        setDeviceId(newDeviceId);
        return newDeviceId;
      }
      // Return a placeholder for server-side rendering
      return "pending-device-id";
    }
    return deviceId;
  }, [deviceId]);

  /**
   * Get API URL for the presence service using your app's proxy
   */
  const getApiUrl = useCallback((endpoint: string): string => {
    // Use proxy API instead of direct connection
    // Make sure endpoint starts with a slash
    const formattedEndpoint = endpoint.startsWith("/")
      ? endpoint
      : `/${endpoint}`;
    return `${PRESENCE_PATH}${formattedEndpoint}`;
  }, []);

  /**
   * Validate a JWT token (debug purposes only)
   */
  const validateToken = useCallback(
    async (token: string): Promise<ApiResponse> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(getApiUrl(`/debug/token?token=${token}`), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (err: any) {
        const errorMsg = err.message || "Failed to validate token";
        setError(errorMsg);
        console.error("Error validating token:", err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [getApiUrl]
  );

  /**
   * Get current user's status
   */
  const getCurrentStatus = useCallback(async (): Promise<ApiResponse> => {
    if (!session?.access_token) {
      return { success: false, message: "Not authenticated" };
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl("/status"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.status) {
        setCurrentStatus(data.status);
      }

      return data;
    } catch (err: any) {
      const errorMsg = err.message || "Failed to get current status";
      setError(errorMsg);
      console.error("Error getting current status:", err);
      return { success: false, message: errorMsg };
    } finally {
      setIsLoading(false);
    }
  }, [session, getApiUrl]);

  /**
   * Get user's status by ID
   */
  const getUserStatus = useCallback(
    async (userId: string): Promise<ApiResponse> => {
      if (!session?.access_token) {
        return { success: false, message: "Not authenticated" };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(getApiUrl(`/users/${userId}/status`), {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.user_id && data.status) {
          // Update user statuses cache
          setUserStatuses((prev) => {
            const newMap = new Map(prev);
            newMap.set(data.user_id, {
              user_id: data.user_id,
              status: data.status,
              last_active: data.last_active || new Date().toISOString(),
            });
            return newMap;
          });
        }

        return data;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to get user status";
        setError(errorMsg);
        console.error(`Error getting status for user ${userId}:`, err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [session, getApiUrl]
  );

  /**
   * Get multiple users' statuses
   */
  const getUsersStatus = useCallback(
    async (userIds: string[]): Promise<ApiResponse> => {
      if (!session?.access_token) {
        console.error("[Presence] No access token available.");
        return {
          success: false,
          message: "Not authenticated",
        };
      }

      if (!userIds || userIds.length === 0) {
        console.warn("[Presence] No user IDs provided for getUsersStatus.");
        return {
          success: false,
          message: "No user IDs provided",
        };
      }

      setIsLoading(true);
      setError(null);

      try {
        console.log("[Presence] getUsersStatus userIds:", userIds);
        const userIdsParam = userIds.join(",");
        const url = getApiUrl(`/users?user_ids=${userIdsParam}`);
        console.log("[Presence] getUsersStatus URL:", url);

        const response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`[Presence] Error response body: ${errorText}`);
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.users && Array.isArray(data.users)) {
          console.log(
            "[Presence] Successfully fetched user statuses:",
            data.users
          );
          setUserStatuses((prev) => {
            const newMap = new Map(prev);
            data.users.forEach((user: any) => {
              if (user.user_id && user.status) {
                newMap.set(user.user_id, {
                  user_id: user.user_id,
                  status: user.status,
                  last_active: user.last_active || new Date().toISOString(),
                });
              }
            });
            return newMap;
          });
        } else {
          console.warn("[Presence] Unexpected response format:", data);
        }

        return data;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to get users status";
        setError(errorMsg);
        console.error("[Presence] Error getting status for users:", err);
        return { success: false, message: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [session, getApiUrl]
  );

  /**
   * Update user's status (PUT method) - for initial status
   */
  const updateStatusPut = useCallback(
    async (status: PresenceStatus): Promise<ApiResponse> => {
      if (!session?.access_token) {
        return { success: false, message: "Not authenticated" };
      }

      setIsLoading(true);
      setError(null);

      try {
        const device = ensureDeviceId();

        // Debug logging to check the request body and URL
        console.log(
          `[Presence] Updating status to ${status} with device ID ${device}`
        );
        console.log(`[Presence] API URL: ${getApiUrl("/status")}`);

        // Using explicit fetch with proper request body formatting
        const response = await fetch(getApiUrl("/status"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            device_id: device,
            status: status,
          }),
          credentials: "include",
        });

        console.log(
          `[Presence] Status update response code: ${response.status}`
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[Presence] Status update error: ${response.status} - ${errorText}`
          );
          throw new Error(`Error ${response.status}: ${errorText}`);
        }

        // Try to parse JSON response, but don't fail if it's not JSON
        let data;
        try {
          data = await response.json();
          console.log(`[Presence] Status update success:`, data);
        } catch (e) {
          const text = await response.text();
          console.log(`[Presence] Non-JSON response: ${text}`);
          data = { success: response.ok, message: text };
        }

        // If we got here, consider it a success regardless of the response format
        setCurrentStatus(status);
        return { success: true, data };
      } catch (err: any) {
        const errorMsg = err.message || "Failed to update status";
        setError(errorMsg);
        console.error("[Presence] Error updating status:", err);
        return { success: false, message: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [session, getApiUrl, ensureDeviceId]
  );

  /**
   * Update user's status (POST method) - for subsequent updates
   */
  const updateStatusPost = useCallback(
    async (status: PresenceStatus): Promise<ApiResponse> => {
      if (!session?.access_token) {
        return { success: false, message: "Not authenticated" };
      }

      setIsLoading(true);
      setError(null);

      try {
        const device = ensureDeviceId();

        // Normal API call
        const response = await fetch(getApiUrl("/status"), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            device_id: device,
            status,
          }),
          credentials: "include", // Include credentials for cookies
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[Presence] Error updating status: ${errorText}`);
          throw new Error(`Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        if (data.success !== false) {
          // Accept any non-failure response
          setCurrentStatus(status);
        }

        return data;
      } catch (err: any) {
        const errorMsg = err.message || "Failed to update status";
        console.error("[Presence] Error updating status:", err);
        setError(errorMsg);
        return { success: false, message: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [session, getApiUrl, ensureDeviceId]
  );

  /**
   * Set initial status when app loads
   */
  const setInitialStatus = useCallback(
    (status: PresenceStatus = "online"): Promise<ApiResponse> => {
      // Use the PUT method to update status when setting initial status
      return updateStatusPut(status);
    },
    [updateStatusPut]
  );

  /**
   * Update user's status
   * This method will be used for subsequent updates
   */
  const updateStatus = useCallback(
    (status: PresenceStatus): Promise<ApiResponse> => {
      // Use the POST method for subsequent updates
      return updateStatusPost(status);
    },
    [updateStatusPost]
  );

  /**
   * Establish WebSocket connection for real-time presence updates
   */
  const connectWebSocket = useCallback(
    (token?: string) => {
      if (!token && !session?.access_token) {
        setError("Authentication token not available");
        return;
      }

      const authToken = token || session?.access_token;

      // Close existing connection if any
      if (wsConnectionRef.current) {
        wsConnectionRef.current.close();
        wsConnectionRef.current = null;
      }

      setIsWsConnected(false);

      try {
        // Use direct WebSocket connection to the backend
        const wsUrl = `ws://localhost:8085/api/presence/ws?token=${authToken}`;

        console.log(`[Presence WebSocket] Connecting directly to: ${wsUrl}`);

        wsConnectionRef.current = new WebSocket(wsUrl);

        // Setup event handlers
        wsConnectionRef.current.onopen = () => {
          console.log("[Presence WebSocket] Connected successfully");
          setIsWsConnected(true);
          setError(null);
        };

        wsConnectionRef.current.onclose = (event) => {
          console.log(
            `[Presence WebSocket] Disconnected: Code ${event.code}, Reason: ${
              event.reason || "No reason provided"
            }`
          );
          setIsWsConnected(false);
        };

        wsConnectionRef.current.onerror = (err) => {
          // Enhanced error logging for debugging
          console.error("[Presence WebSocket] Error event details:", {
            error: err,
            type: err instanceof Event ? err.type : "unknown",
            // Add more properties to inspect the error object
            properties: Object.keys(err || {}),
          });

          if (wsConnectionRef.current) {
            console.error("[Presence WebSocket] Connection state:", {
              readyState: wsConnectionRef.current.readyState,
              url: wsConnectionRef.current.url,
              protocol: wsConnectionRef.current.protocol || "none",
              bufferedAmount: wsConnectionRef.current.bufferedAmount,
            });
          }

          // Set error state but don't crash the application
          setError("WebSocket connection error");

          // Try to reconnect after a short delay
          setTimeout(() => {
            // Check if we're already trying to connect before attempting reconnection
            if (
              wsConnectionRef.current &&
              wsConnectionRef.current.readyState === WebSocket.CONNECTING
            )
              return;
            connectWebSocket();
          }, 5000);
          setIsWsConnected(false);
        };

        wsConnectionRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log("[Presence WebSocket] Received message:", data);

            // Handle different message types
            if (data.type === "status_update" && data.user_id && data.status) {
              // Update user status in our local cache
              setUserStatuses((prev) => {
                const newMap = new Map(prev);
                newMap.set(data.user_id, {
                  user_id: data.user_id,
                  status: data.status,
                  last_active: data.timestamp || new Date().toISOString(),
                });
                return newMap;
              });

              console.log(
                `[Presence WebSocket] User ${data.user_id} is now ${data.status}`
              );
            }
          } catch (err) {
            console.error("[Presence WebSocket] Failed to parse message:", err);
          }
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error
            ? err.message
            : "Failed to setup WebSocket connection";
        console.error("[Presence WebSocket] Setup error:", err);
        setError(errorMsg);
      }
    },
    [session]
  );

  /**
   * Disconnect WebSocket
   */
  const disconnectWebSocket = useCallback(() => {
    if (wsConnectionRef.current) {
      console.log("[Presence WebSocket] Manually disconnecting");
      wsConnectionRef.current.close();
      wsConnectionRef.current = null;
      setIsWsConnected(false);
    }
  }, []);

  /**
   * Get status from cache
   */
  const getStatus = useCallback(
    (userId: string): PresenceStatus => {
      // Check in real statuses
      const cachedStatus = userStatuses.get(userId)?.status;
      if (cachedStatus) return cachedStatus;

      return "offline";
    },
    [userStatuses]
  );

  /**
   * Get last active time from cache
   */
  const getLastActive = useCallback(
    (userId: string): string | null => {
      // Check real data
      const cachedLastActive = userStatuses.get(userId)?.last_active;
      if (cachedLastActive) return cachedLastActive;

      return null;
    },
    [userStatuses]
  );

  // Connect when component mounts if autoConnect is true
  useEffect(() => {
    if (options.autoConnect && session?.access_token) {
      console.log("[Presence] Auto-connecting");
      connectWebSocket(session.access_token);

      // Set initial status to online when connecting
      setInitialStatus("online");
    }

    // Clean up on unmount
    return () => {
      disconnectWebSocket();
    };
  }, [
    options.autoConnect,
    connectWebSocket,
    disconnectWebSocket,
    session,
    setInitialStatus,
  ]);

  // Return methods and state
  return {
    // State
    currentStatus,
    isLoading,
    error,
    isWsConnected,
    userStatuses,
    deviceId,

    // Methods
    validateToken,
    connectWebSocket,
    disconnectWebSocket,
    updateStatus,
    updateStatusPut,
    updateStatusPost,
    getCurrentStatus,
    getUserStatus,
    getUsersStatus,
    getStatus,
    getLastActive,
    setInitialStatus,
    ensureDeviceId,
  };
}
