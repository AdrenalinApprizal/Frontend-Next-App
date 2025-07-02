import { useState, useCallback, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

// Define types
export type PresenceStatus = "online" | "offline";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_active: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  data?: any;
  status?: number;
  statusText?: string;
  error?: boolean;
}

interface UsePresenceOptions {
  autoConnect?: boolean;
  enableActivityDetection?: boolean;
}

const PRESENCE_PATH = "/api/proxy/presence";

export function usePresence(
  options: UsePresenceOptions = { autoConnect: true }
) {
  const { autoConnect = true, enableActivityDetection = true } = options;
  const { data: session } = useSession();

  // State
  const [currentStatus, setCurrentStatus] = useState<PresenceStatus>("online");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [userStatuses, setUserStatuses] = useState<Map<string, UserPresence>>(
    new Map()
  );
  const [deviceId, setDeviceId] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  // Refs
  const hasInitializedRef = useRef<boolean>(false);

  // Generate or retrieve device ID
  useEffect(() => {
    const storedDeviceId = localStorage.getItem("device_id");
    if (storedDeviceId) {
      setDeviceId(storedDeviceId);
    } else {
      const newDeviceId = `device_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem("device_id", newDeviceId);
      setDeviceId(newDeviceId);
    }
  }, []);

  // Update presence status via HTTP API
  const updateStatusPost = useCallback(
    async (status: PresenceStatus): Promise<ApiResponse> => {
      if (!session?.access_token || !deviceId) {
        const errorMsg = "Authentication token or device ID not available";
        setError(errorMsg);
        return { success: false, error: true, message: errorMsg };
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${PRESENCE_PATH}/status`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            device_id: deviceId,
            status,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success !== false) {
          setCurrentStatus(status);
          return { success: true, data };
        } else {
          const errorMsg =
            data.message || `HTTP ${response.status}: ${response.statusText}`;
          setError(errorMsg);
          console.error("[Presence] Failed to update status:", errorMsg);
          return { success: false, error: true, message: errorMsg };
        }
      } catch (error: any) {
        const errorMsg = error.message || "Network error occurred";
        setError(errorMsg);
        console.error("[Presence] Network error:", error);
        return { success: false, error: true, message: errorMsg };
      } finally {
        setIsLoading(false);
      }
    },
    [session?.access_token, deviceId]
  );

  // Main update function
  const updateStatus = useCallback(
    (status: PresenceStatus): Promise<ApiResponse> => {
      return updateStatusPost(status);
    },
    [updateStatusPost]
  );

  // WebSocket connection (disabled for now)
  const connectWebSocket = useCallback((token?: string) => {
    setIsWsConnected(false);
    setError("WebSocket presence not available - using HTTP fallback");
  }, []);

  // Disconnect WebSocket (no-op for now)
  const disconnectWebSocket = useCallback(() => {
    setIsWsConnected(false);
  }, []);

  // Get user status
  const getUserStatus = useCallback(
    (userId: string): PresenceStatus | null => {
      return userStatuses.get(userId)?.status || null;
    },
    [userStatuses]
  );

  // Get last active time
  const getLastActive = useCallback(
    (userId: string): string | null => {
      return userStatuses.get(userId)?.last_active || null;
    },
    [userStatuses]
  );

  // Set initial status
  const setInitialStatus = useCallback(async () => {
    if (session?.access_token && deviceId) {
      await updateStatus("online");
    }
  }, [session?.access_token, deviceId, updateStatus]);

  // Activity tracking (simplified)
  const trackUserActivity = useCallback(() => {
    if (!enableActivityDetection) return;

    // Simply ensure user is marked as online when active
    if (currentStatus === "offline") {
      updateStatus("online");
    }
  }, [enableActivityDetection, currentStatus, updateStatus]);

  // Initialize presence system
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!autoConnect || !session?.access_token) return;

    hasInitializedRef.current = true;


    // Connect WebSocket (skipped for now)
    connectWebSocket(session.access_token);

    // Set initial status
    setInitialStatus();

    // Setup activity detection
    if (enableActivityDetection && typeof window !== "undefined") {
      const handleActivity = () => trackUserActivity();

      document.addEventListener("mousemove", handleActivity, { passive: true });
      document.addEventListener("keypress", handleActivity, { passive: true });
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
          trackUserActivity();
        }
      });
      window.addEventListener("focus", handleActivity);

      return () => {
        hasInitializedRef.current = false;
        disconnectWebSocket();

        document.removeEventListener("mousemove", handleActivity);
        document.removeEventListener("keypress", handleActivity);
        document.removeEventListener("visibilitychange", handleActivity);
        window.removeEventListener("focus", handleActivity);
      };
    }
  }, [
    autoConnect,
    session?.access_token,
    connectWebSocket,
    setInitialStatus,
    enableActivityDetection,
    trackUserActivity,
    disconnectWebSocket,
  ]);

  // Handle session changes
  useEffect(() => {
    if (autoConnect && session?.access_token && !isWsConnected) {
      connectWebSocket(session.access_token);
    } else if (!session?.access_token && isWsConnected) {
      disconnectWebSocket();
    }
  }, [
    autoConnect,
    session?.access_token,
    isWsConnected,
    connectWebSocket,
    disconnectWebSocket,
  ]);

  return {
    // State
    currentStatus,
    isLoading,
    error,
    isWsConnected,
    userStatuses,
    deviceId,
    isActive,

    // Actions
    updateStatus,
    connectWebSocket,
    disconnectWebSocket,
    setInitialStatus,
    getStatus: getUserStatus, // Alias for compatibility
    getUserStatus,
    getLastActive,
  };
}

export default usePresence;
