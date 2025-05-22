import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Message types that can be sent/received via WebSocket
export enum WebSocketMessageType {
  MESSAGE = "message",
  TYPING = "typing",
  STOP_TYPING = "stop_typing", // Added missing STOP_TYPING enum value
  STATUS = "status",
  READ = "read",
  UNREAD_COUNT = "unread_count",
  MESSAGE_REACTION = "message_reaction", // Support for message reactions
  ERROR = "error",
}

// Message interfaces
export interface WebSocketMessage {
  type: WebSocketMessageType;
  data: any;
}

export interface NewMessageData {
  id: string;
  sender_id: string; // Changed to match the provided code
  recipient_id: string; // Changed to match the provided code
  content: string;
  type: string; // Added from the provided code
  read: boolean;
  created_at: string; // Changed to match the provided code
  updated_at: string; // Added from the provided code
  media_url?: string; // Changed to match the provided code
  sender?: {
    id: string;
    name: string;
    profile_picture_url?: string; // Changed to match the provided code
  };
}

export interface UserStatusData {
  user_id: string;
  status: "online" | "offline" | "busy" | "away";
  last_seen?: string; // Changed to match the provided code
}

export interface TypingData {
  user_id: string; // Changed to match the provided code
  recipient_id: string; // Changed to match the provided code
  is_typing: boolean; // Changed to match the provided code
}

// Custom event system (similar to Vue's eventBus)
type EventCallback = (...args: any[]) => void;
class EventBus {
  private events: Record<string, EventCallback[]> = {};

  on(event: string, callback: EventCallback) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(callback);
  }

  off(event: string, callback: EventCallback) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((cb) => cb !== callback);
  }

  emit(event: string, ...args: any[]) {
    if (!this.events[event]) return;
    this.events[event].forEach((callback) => callback(...args));
  }
}

// Create a singleton event bus
export const eventBus = new EventBus();

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

export function useWebSocket(
  options: UseWebSocketOptions = { autoConnect: true }
) {
  const { data: session } = useSession();
  const router = useRouter();

  // State variables for Messages WebSocket
  const socketMessagesRef = useRef<WebSocket | null>(null);
  const [isMessagesConnected, setIsMessagesConnected] = useState(false);
  const [isMessagesConnecting, setIsMessagesConnecting] = useState(false);

  // State variables for Presence WebSocket
  const socketPresenceRef = useRef<WebSocket | null>(null);
  const [isPresenceConnected, setIsPresenceConnected] = useState(false);
  const [isPresenceConnecting, setIsPresenceConnecting] = useState(false);

  // Combined state
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<NewMessageData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Shared state
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectIntervalRef = useRef(2000); // Start with 2 seconds
  const messageQueueRef = useRef<WebSocketMessage[]>([]);
  const activeSubscriptionsRef = useRef<string[]>([]);
  const authCheckInProgressRef = useRef(false);

  // Helper to update the combined connection state
  const updateConnectedState = useCallback(() => {
    setIsConnected(isMessagesConnected && isPresenceConnected);
    setIsConnecting(isMessagesConnecting || isPresenceConnecting);
  }, [
    isMessagesConnected,
    isPresenceConnected,
    isMessagesConnecting,
    isPresenceConnecting,
  ]);

  // Get the appropriate WebSocket URL for messages
  const getMessagesWebSocketUrl = useCallback((): string => {
    if (!session?.access_token) {
      throw new Error("No authentication token available");
    }

    // Use the proxy API path instead of direct connection for more reliable behavior
    const protocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const host =
      typeof window !== "undefined" ? window.location.host : "localhost:3000";

    // Use the API proxy route instead of connecting directly
    return `${protocol}//${host}/api/proxy/messages/ws?token=${session.access_token}`;
  }, [session?.access_token]);

  // Get the appropriate WebSocket URL for presence
  const getPresenceWebSocketUrl = useCallback((): string => {
    if (!session?.access_token) {
      throw new Error("No authentication token available");
    }

    // Use the proxy API path instead of direct connection for more reliable behavior
    const protocol =
      typeof window !== "undefined" && window.location.protocol === "https:"
        ? "wss:"
        : "ws:";
    const host =
      typeof window !== "undefined" ? window.location.host : "localhost:3000";

    // Use the API proxy route instead of connecting directly
    return `${protocol}//${host}/api/proxy/presence/ws?token=${session.access_token}`;
  }, [session?.access_token]);

  // Validate token before connecting
  const validateToken = useCallback(async (): Promise<boolean> => {
    if (authCheckInProgressRef.current) return false;

    try {
      authCheckInProgressRef.current = true;

      // Check for authentication token
      if (!session?.access_token) {
        console.error("[WebSocket] No authentication token available");
        return false;
      }

      // In a real implementation, you might want to verify the token with the server
      return true;
    } catch (error) {
      console.error("[WebSocket] Token validation error:", error);
      return false;
    } finally {
      authCheckInProgressRef.current = false;
    }
  }, [session?.access_token]);

  // Handle authentication failure
  const handleAuthFailure = useCallback(() => {
    console.warn("[WebSocket] Authentication failure detected");

    // Clean up WebSocket resources
    disconnect();
    clear();

    // Show toast notification (if you have a toast library)
    // Example: toast.error("Authentication failed. Please log in again.");

    // Redirect to login page
    if (typeof window !== "undefined") {
      router.push("/login");
    }
  }, [router]);

  // Initialize WebSocket connections
  const connect = useCallback(async () => {
    // Validate authentication before connecting
    const isTokenValid = await validateToken();
    if (!isTokenValid) {
      console.warn("[WebSocket] Invalid token, cannot connect");
      return;
    }

    // Connect both WebSockets
    connectMessagesWebSocket();
    connectPresenceWebSocket();
  }, [validateToken]);

  // Initialize Messages WebSocket connection
  const connectMessagesWebSocket = useCallback(() => {
    // Don't try to connect if already connecting or connected
    if (isMessagesConnecting || isMessagesConnected) {
      return;
    }

    try {
      setIsMessagesConnecting(true);
      setError(null);

      const wsUrl = getMessagesWebSocketUrl();
      console.log(`[WebSocket Messages] Connecting to ${wsUrl}`);

      socketMessagesRef.current = new WebSocket(wsUrl);

      // Set timeout to fail fast if connection hangs
      const timeoutId = setTimeout(() => {
        if (
          socketMessagesRef.current &&
          socketMessagesRef.current.readyState !== WebSocket.OPEN
        ) {
          console.warn("[WebSocket Messages] Connection timeout");
          socketMessagesRef.current.close(4000, "Connection timeout");
          setError("Messages WebSocket connection timeout");
          setIsMessagesConnecting(false);
          updateConnectedState();
        }
      }, 10000); // 10 second timeout

      // Handle WebSocket events
      socketMessagesRef.current.onopen = (event) => {
        clearTimeout(timeoutId);
        handleMessagesOpen(event);
      };

      socketMessagesRef.current.onmessage = handleMessagesMessage;
      socketMessagesRef.current.onerror = handleMessagesError;
      socketMessagesRef.current.onclose = handleMessagesClose;
    } catch (err: any) {
      console.error("[WebSocket Messages] Connection error:", err);
      setError(err.message || "Failed to connect to Messages WebSocket server");

      if (
        err.message?.includes("authentication") ||
        err.message?.includes("token")
      ) {
        handleAuthFailure();
      } else {
        handleMessagesReconnect();
      }
    }
  }, [
    isMessagesConnecting,
    isMessagesConnected,
    getMessagesWebSocketUrl,
    handleAuthFailure,
    updateConnectedState,
  ]);

  // Initialize Presence WebSocket connection
  const connectPresenceWebSocket = useCallback(() => {
    // Don't try to connect if already connecting or connected
    if (isPresenceConnecting || isPresenceConnected) {
      return;
    }

    try {
      setIsPresenceConnecting(true);
      setError(null);

      const wsUrl = getPresenceWebSocketUrl();
      console.log(`[WebSocket Presence] Connecting to ${wsUrl}`);

      socketPresenceRef.current = new WebSocket(wsUrl);

      // Set timeout to fail fast if connection hangs
      const timeoutId = setTimeout(() => {
        if (
          socketPresenceRef.current &&
          socketPresenceRef.current.readyState !== WebSocket.OPEN
        ) {
          console.warn("[WebSocket Presence] Connection timeout");
          socketPresenceRef.current.close(4000, "Connection timeout");
          setError("Presence WebSocket connection timeout");
          setIsPresenceConnecting(false);
          updateConnectedState();
        }
      }, 10000); // 10 second timeout

      // Handle WebSocket events
      socketPresenceRef.current.onopen = (event) => {
        clearTimeout(timeoutId);
        handlePresenceOpen(event);
      };

      socketPresenceRef.current.onmessage = handlePresenceMessage;
      socketPresenceRef.current.onerror = handlePresenceError;
      socketPresenceRef.current.onclose = handlePresenceClose;
    } catch (err: any) {
      console.error("[WebSocket Presence] Connection error:", err);
      setError(err.message || "Failed to connect to Presence WebSocket server");

      if (
        err.message?.includes("authentication") ||
        err.message?.includes("token")
      ) {
        handleAuthFailure();
      } else {
        handlePresenceReconnect();
      }
    }
  }, [
    isPresenceConnecting,
    isPresenceConnected,
    getPresenceWebSocketUrl,
    handleAuthFailure,
    updateConnectedState,
  ]);

  // Handle successful Messages connection
  const handleMessagesOpen = useCallback(
    (event: Event) => {
      console.log("[WebSocket Messages] Connection established");
      setIsMessagesConnected(true);
      setIsMessagesConnecting(false);
      reconnectAttemptsRef.current = 0;
      reconnectIntervalRef.current = 2000; // Reset reconnect interval

      // Subscribe to unread counts on connection
      subscribeToUnreadCounts();

      // Send any queued messages
      if (messageQueueRef.current.length > 0) {
        console.log(
          `[WebSocket Messages] Sending ${messageQueueRef.current.length} queued messages`
        );
        messageQueueRef.current.forEach((message) => sendMessage(message));
        messageQueueRef.current = [];
      }

      // Show toast notification (if you have a toast library)
      // Example: toast.success("Connected to messaging service");

      // Update combined connection state
      updateConnectedState();
    },
    [updateConnectedState]
  );

  // Handle successful Presence connection
  const handlePresenceOpen = useCallback(
    (event: Event) => {
      console.log("[WebSocket Presence] Connection established");
      setIsPresenceConnected(true);
      setIsPresenceConnecting(false);

      // Try to resubscribe to any previous channels
      if (activeSubscriptionsRef.current.length > 0) {
        activeSubscriptionsRef.current.forEach((channel) => {
          subscribeToChannel(channel);
        });
      }

      // Show toast notification (if you have a toast library)
      // Example: toast.success("Connected to presence service");

      // Update combined connection state
      updateConnectedState();
    },
    [updateConnectedState]
  );

  // Subscribe to unread message counts
  const subscribeToUnreadCounts = useCallback(() => {
    if (!isMessagesConnected || !socketMessagesRef.current) return;

    const unreadSubscription = {
      action: "subscribe",
      channel: "unread_counts",
    };

    try {
      socketMessagesRef.current.send(JSON.stringify(unreadSubscription));
      console.log("[WebSocket Messages] Subscribed to unread counts");
    } catch (error) {
      console.error(
        "[WebSocket Messages] Error subscribing to unread counts:",
        error
      );
    }
  }, [isMessagesConnected]);

  // Subscribe to a specific channel
  const subscribeToChannel = useCallback(
    (channel: string) => {
      if (!isPresenceConnected || !socketPresenceRef.current) return;

      // Don't subscribe if already subscribed
      if (activeSubscriptionsRef.current.includes(channel)) return;

      const subscription = {
        action: "subscribe",
        channel: channel,
      };

      try {
        socketPresenceRef.current.send(JSON.stringify(subscription));
        console.log(`[WebSocket Presence] Subscribed to channel: ${channel}`);

        // Add to active subscriptions
        if (!activeSubscriptionsRef.current.includes(channel)) {
          activeSubscriptionsRef.current = [
            ...activeSubscriptionsRef.current,
            channel,
          ];
        }
      } catch (error) {
        console.error(
          `[WebSocket Presence] Error subscribing to channel ${channel}:`,
          error
        );
      }
    },
    [isPresenceConnected]
  );

  // Handle incoming messages from Messages WebSocket
  const handleMessagesMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      console.log("[WebSocket Messages] Received message:", message);

      // Process message based on its type
      switch (message.type) {
        case WebSocketMessageType.MESSAGE:
          handleNewMessage(message.data);
          break;

        case WebSocketMessageType.TYPING:
          handleTypingNotification(message.data);
          break;

        case WebSocketMessageType.UNREAD_COUNT:
          handleUnreadCount(message.data);
          break;

        case WebSocketMessageType.READ:
          handleMessageRead(message.data);
          break;

        case WebSocketMessageType.ERROR:
          console.error(
            "[WebSocket Messages] Error from server:",
            message.data
          );
          setError(
            `Error from server: ${message.data.message || "Unknown error"}`
          );
          // Show toast notification (if you have a toast library)
          // Example: toast.error(message.data.message || "Error from messaging server");
          break;

        default:
          console.log(
            "[WebSocket Messages] Unhandled message type:",
            message.type
          );
      }
    } catch (error) {
      console.error("[WebSocket Messages] Failed to parse message:", error);
    }
  }, []);

  // Handle incoming messages from Presence WebSocket
  const handlePresenceMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data) as WebSocketMessage;
      console.log("[WebSocket Presence] Received message:", message);

      // Process message based on its type
      switch (message.type) {
        case WebSocketMessageType.STATUS:
          handleStatusChange(message.data);
          break;

        case WebSocketMessageType.ERROR:
          console.error(
            "[WebSocket Presence] Error from server:",
            message.data
          );
          setError(
            `Error from server: ${message.data.message || "Unknown error"}`
          );
          // Show toast notification (if you have a toast library)
          // Example: toast.error(message.data.message || "Error from presence server");
          break;

        default:
          console.log(
            "[WebSocket Presence] Unhandled message type:",
            message.type
          );
      }
    } catch (error) {
      console.error("[WebSocket Presence] Failed to parse message:", error);
    }
  }, []);

  // Handle unread message count updates from WebSocket
  const handleUnreadCount = useCallback((data: any) => {
    if (!data.unreadCounts) return;

    // Emit event using our event bus
    eventBus.emit("unread-counts-updated", data.unreadCounts);

    console.log(
      "[WebSocket Messages] Unread counts updated:",
      data.unreadCounts
    );
  }, []);

  // Handle message read status updates
  const handleMessageRead = useCallback((data: { message_ids: string[] }) => {
    if (!data.message_ids) return;

    // Update local messages state to mark messages as read
    setMessages((prevMessages) =>
      prevMessages.map((message) =>
        data.message_ids.includes(message.id)
          ? { ...message, read: true }
          : message
      )
    );

    // Emit event for components to react to read status changes
    eventBus.emit("messages-read", data.message_ids);
  }, []);

  // Handle typing notifications
  const handleTypingNotification = useCallback((data: TypingData) => {
    console.log(
      `[WebSocket] User ${data.user_id} is ${
        data.is_typing ? "typing" : "not typing"
      } to ${data.recipient_id}`
    );

    // Emit event for components to react to typing status
    eventBus.emit("typing-status-changed", {
      userId: data.user_id,
      recipientId: data.recipient_id,
      isTyping: data.is_typing,
    });
  }, []);

  // Handle user status changes
  const handleStatusChange = useCallback((data: UserStatusData) => {
    console.log(
      `[WebSocket Presence] User ${data.user_id} status changed to ${data.status}`
    );

    // Emit event for components to update UI
    eventBus.emit("user-status-changed", {
      userId: data.user_id,
      status: data.status,
      lastSeen: data.last_seen,
    });
  }, []);

  // Process a new incoming message
  const handleNewMessage = useCallback((data: NewMessageData) => {
    console.log("[WebSocket Messages] New message:", data);

    // Add new message to the state
    setMessages((prevMessages) => {
      // Check if message already exists to avoid duplicates
      const existingMessage = prevMessages.find((m) => m.id === data.id);
      if (!existingMessage) {
        // Show toast notification (if you have a toast library) for new messages
        // if (data.sender_id !== session?.user?.id) {
        //   toast.info(`New message from ${data.sender?.name || "User"}`);
        // }
        return [...prevMessages, data];
      }
      return prevMessages;
    });

    // Emit event for components to react to new messages
    eventBus.emit("new-message", data);
  }, []);

  // Handle errors for Messages WebSocket
  const handleMessagesError = useCallback(
    (event: Event) => {
      console.error("[WebSocket Messages] Error:", event);
      setError("WebSocket Messages connection error");
      setIsMessagesConnecting(false);
      updateConnectedState();
    },
    [updateConnectedState]
  );

  // Handle errors for Presence WebSocket
  const handlePresenceError = useCallback(
    (event: Event) => {
      console.error("[WebSocket Presence] Error:", event);
      setError("WebSocket Presence connection error");
      setIsPresenceConnecting(false);
      updateConnectedState();
    },
    [updateConnectedState]
  );

  // Handle connection close for Messages WebSocket
  const handleMessagesClose = useCallback(
    (event: CloseEvent) => {
      console.log(
        `[WebSocket Messages] Connection closed. Code: ${event.code}, Reason: ${
          event.reason || "No reason provided"
        }`
      );
      setIsMessagesConnected(false);
      setIsMessagesConnecting(false);
      updateConnectedState();

      // Check for authentication errors based on close code
      if (
        event.code === 1008 ||
        (event.code >= 4000 && event.code <= 4099) ||
        event.reason?.toLowerCase().includes("auth") ||
        event.reason?.toLowerCase().includes("token")
      ) {
        // Likely authentication issue
        handleAuthFailure();
      }
      // Attempt to reconnect for other issues
      else if (event.code !== 1000 && event.code !== 1001) {
        handleMessagesReconnect();
      }
    },
    [updateConnectedState, handleAuthFailure]
  );

  // Handle connection close for Presence WebSocket
  const handlePresenceClose = useCallback(
    (event: CloseEvent) => {
      console.log(
        `[WebSocket Presence] Connection closed. Code: ${event.code}, Reason: ${
          event.reason || "No reason provided"
        }`
      );
      setIsPresenceConnected(false);
      setIsPresenceConnecting(false);
      updateConnectedState();

      // Check for authentication errors based on close code
      if (
        event.code === 1008 ||
        (event.code >= 4000 && event.code <= 4099) ||
        event.reason?.toLowerCase().includes("auth") ||
        event.reason?.toLowerCase().includes("token")
      ) {
        // Likely authentication issue
        handleAuthFailure();
      }
      // Attempt to reconnect for other issues
      else if (event.code !== 1000 && event.code !== 1001) {
        handlePresenceReconnect();
      }
    },
    [updateConnectedState, handleAuthFailure]
  );

  // Handle reconnection for Messages WebSocket
  const handleMessagesReconnect = useCallback(() => {
    // Only attempt to reconnect if authenticated and not exceeding max attempts
    if (
      !session?.access_token ||
      reconnectAttemptsRef.current >= maxReconnectAttempts
    ) {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log("[WebSocket Messages] Max reconnection attempts reached");
        setError("Failed to connect after multiple attempts");
        // Show toast notification (if you have a toast library)
        // Example: toast.error("Failed to connect to messaging service. Please refresh the page.");
      }
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = reconnectIntervalRef.current * reconnectAttemptsRef.current;
    console.log(
      `[WebSocket Messages] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
    );

    setTimeout(() => {
      connectMessagesWebSocket();
    }, delay);
  }, [session?.access_token, connectMessagesWebSocket]);

  // Handle reconnection for Presence WebSocket
  const handlePresenceReconnect = useCallback(() => {
    // Only attempt to reconnect if authenticated and not exceeding max attempts
    if (
      !session?.access_token ||
      reconnectAttemptsRef.current >= maxReconnectAttempts
    ) {
      if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log("[WebSocket Presence] Max reconnection attempts reached");
        setError("Failed to connect after multiple attempts");
        // Show toast notification (if you have a toast library)
        // Example: toast.error("Failed to connect to presence service. Please refresh the page.");
      }
      return;
    }

    reconnectAttemptsRef.current++;
    const delay = reconnectIntervalRef.current * reconnectAttemptsRef.current;
    console.log(
      `[WebSocket Presence] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
    );

    setTimeout(() => {
      connectPresenceWebSocket();
    }, delay);
  }, [session?.access_token, connectPresenceWebSocket]);

  // Send a message through Messages WebSocket
  const sendMessage = useCallback(
    (message: WebSocketMessage) => {
      if (!isMessagesConnected || !socketMessagesRef.current) {
        // Queue message for when connection is established
        console.log(
          "[WebSocket Messages] Connection not ready, queueing message"
        );
        messageQueueRef.current = [...messageQueueRef.current, message];

        // Try to connect if not already connecting
        if (!isMessagesConnecting && !isMessagesConnected) {
          connectMessagesWebSocket();
        }
        return;
      }

      try {
        socketMessagesRef.current.send(JSON.stringify(message));
      } catch (error) {
        console.error("[WebSocket Messages] Failed to send message:", error);
        // Add to queue to retry later
        messageQueueRef.current = [...messageQueueRef.current, message];
      }
    },
    [isMessagesConnected, isMessagesConnecting, connectMessagesWebSocket]
  );

  // Send typing indicator
  const sendTypingStatus = useCallback(
    (recipientId: string, isTyping: boolean) => {
      if (!session?.user?.id) return;

      sendMessage({
        type: isTyping
          ? WebSocketMessageType.TYPING
          : WebSocketMessageType.STOP_TYPING,
        data: {
          user_id: session.user.id,
          recipient_id: recipientId,
          is_typing: isTyping,
        },
      });
    },
    [session?.user?.id, sendMessage]
  );

  // Send private message via WebSocket
  const sendPrivateMessage = useCallback(
    (receiverId: string, content: string) => {
      if (!session?.user?.id || !isMessagesConnected) {
        console.error(
          "[WebSocket Messages] Cannot send private message: Not connected or no user ID"
        );
        return false;
      }

      try {
        console.log(
          `[WebSocket Messages] Sending private message to ${receiverId}`
        );

        sendMessage({
          type: WebSocketMessageType.MESSAGE,
          data: {
            recipient_id: receiverId,
            content: content,
          },
        });

        return true;
      } catch (err: any) {
        console.error(
          "[WebSocket Messages] Error sending private message:",
          err
        );
        setError(`Failed to send message: ${err.message}`);
        return false;
      }
    },
    [session?.user?.id, isMessagesConnected, sendMessage]
  );

  // Send group message via WebSocket
  const sendGroupMessage = useCallback(
    (groupId: string, content: string) => {
      if (!session?.user?.id || !isMessagesConnected) {
        console.error(
          "[WebSocket Messages] Cannot send group message: Not connected or no user ID"
        );
        return false;
      }

      try {
        console.log(`[WebSocket Messages] Sending group message to ${groupId}`);

        sendMessage({
          type: WebSocketMessageType.MESSAGE,
          data: {
            group_id: groupId,
            content: content,
          },
        });

        return true;
      } catch (err: any) {
        console.error("[WebSocket Messages] Error sending group message:", err);
        setError(`Failed to send group message: ${err.message}`);
        return false;
      }
    },
    [session?.user?.id, isMessagesConnected, sendMessage]
  );

  // Disconnect both WebSockets
  const disconnect = useCallback(() => {
    disconnectMessages();
    disconnectPresence();
  }, []);

  // Disconnect Messages WebSocket
  const disconnectMessages = useCallback(() => {
    if (socketMessagesRef.current) {
      console.log("[WebSocket Messages] Disconnecting...");
      socketMessagesRef.current.close(1000, "User logout");
      socketMessagesRef.current = null;
      setIsMessagesConnected(false);
      setIsMessagesConnecting(false);
      updateConnectedState();
    }
  }, [updateConnectedState]);

  // Disconnect Presence WebSocket
  const disconnectPresence = useCallback(() => {
    if (socketPresenceRef.current) {
      console.log("[WebSocket Presence] Disconnecting...");
      socketPresenceRef.current.close(1000, "User logout");
      socketPresenceRef.current = null;
      setIsPresenceConnected(false);
      setIsPresenceConnecting(false);
      updateConnectedState();
    }
  }, [updateConnectedState]);

  // Clear all state
  const clear = useCallback(() => {
    socketMessagesRef.current = null;
    socketPresenceRef.current = null;
    setIsMessagesConnected(false);
    setIsMessagesConnecting(false);
    setIsPresenceConnected(false);
    setIsPresenceConnecting(false);
    setIsConnected(false);
    setIsConnecting(false);
    reconnectAttemptsRef.current = 0;
    reconnectIntervalRef.current = 2000;
    setError(null);
    messageQueueRef.current = [];
    activeSubscriptionsRef.current = [];
  }, []);

  // Subscribe to private messages from a specific user
  const subscribeToPrivateMessages = useCallback(
    (userId: string) => {
      if (!isMessagesConnected || !socketMessagesRef.current) {
        console.warn("[WebSocket Messages] Cannot subscribe: Not connected");
        return;
      }

      if (!userId) {
        console.error(
          "[WebSocket Messages] Cannot subscribe: No user ID provided"
        );
        return;
      }

      try {
        console.log(
          `[WebSocket Messages] Subscribing to private messages from user: ${userId}`
        );

        const subscription = {
          action: "subscribe",
          channel: `private:${userId}`,
        };

        socketMessagesRef.current.send(JSON.stringify(subscription));

        // Keep track of active subscriptions for reconnection handling
        if (!activeSubscriptionsRef.current.includes(`private:${userId}`)) {
          activeSubscriptionsRef.current = [
            ...activeSubscriptionsRef.current,
            `private:${userId}`,
          ];
        }

        console.log(
          `[WebSocket Messages] Successfully subscribed to messages from: ${userId}`
        );
      } catch (error) {
        console.error(
          `[WebSocket Messages] Error subscribing to private messages from ${userId}:`,
          error
        );
      }
    },
    [isMessagesConnected]
  );

  // Unsubscribe from private messages from a specific user
  const unsubscribeFromPrivateMessages = useCallback(
    (userId: string) => {
      if (!socketMessagesRef.current || !isMessagesConnected) {
        console.warn("[WebSocket Messages] Cannot unsubscribe: Not connected");
        return;
      }

      if (!userId) {
        console.error(
          "[WebSocket Messages] Cannot unsubscribe: No user ID provided"
        );
        return;
      }

      try {
        console.log(
          `[WebSocket Messages] Unsubscribing from private messages for user: ${userId}`
        );

        const unsubscribeAction = {
          action: "unsubscribe",
          channel: `private:${userId}`,
        };

        socketMessagesRef.current.send(JSON.stringify(unsubscribeAction));

        // Remove from active subscriptions list
        activeSubscriptionsRef.current = activeSubscriptionsRef.current.filter(
          (channel) => channel !== `private:${userId}`
        );

        console.log(
          `[WebSocket Messages] Successfully unsubscribed from messages for: ${userId}`
        );
      } catch (error) {
        console.error(
          `[WebSocket Messages] Error unsubscribing from private messages for ${userId}:`,
          error
        );
      }
    },
    [isMessagesConnected]
  );

  // Connect when component mounts if autoConnect is true
  useEffect(() => {
    if (options.autoConnect && session?.access_token) {
      console.log("[WebSocket] Auto-connecting");
      connect();
    }

    // Clean up on unmount
    return () => {
      console.log("[WebSocket] Component unmounting, disconnecting");
      disconnect();
    };
  }, [options.autoConnect, session?.access_token, connect, disconnect]);

  return {
    // Combined state
    isConnected,
    isConnecting,
    messages,
    error,

    // Individual connection states
    isMessagesConnected,
    isMessagesConnecting,
    isPresenceConnected,
    isPresenceConnecting,

    // Methods
    connect,
    disconnect,
    disconnectMessages,
    disconnectPresence,
    clear,
    sendMessage, // Added from Vue example
    sendPrivateMessage,
    sendGroupMessage,
    sendTypingStatus,
    subscribeToChannel,
    subscribeToUnreadCounts,
    subscribeToPrivateMessages, // Added new function
    unsubscribeFromPrivateMessages, // Added new function
    validateToken,
  };
}
