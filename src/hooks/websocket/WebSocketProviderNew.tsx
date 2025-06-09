"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useRef,
} from "react";
import { useWebSocket } from "./useWebSocket";
import { useEventBus } from "./useEventBus";

// Combined WebSocket + EventBus context type
type WebSocketContextType = Omit<
  ReturnType<typeof useWebSocket>,
  "sendPrivateMessage"
> & {
  // Override sendPrivateMessage to be async for EventBus compatibility
  sendPrivateMessage: (receiverId: string, content: string) => Promise<boolean>;

  // EventBus-specific properties
  eventBusConnected: boolean;
  eventBusError: string | null;

  // Combined status
  hasRealTimeConnection: boolean;
  connectionType: "websocket" | "eventbus" | "none";
};

// Create context
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Provider component
export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  console.log("[WebSocketProvider] Initializing provider");

  // Track if we've shown the fallback notification
  const fallbackNotificationShown = useRef(false);

  // Initialize WebSocket service
  const webSocketService = useWebSocket({
    autoConnect: true, // Enable WebSocket connection
  });

  // Initialize EventBus
  const { sendPrivateMessage: eventBusSendMessage } = useEventBus();

  // EventBus is always "connected" since it's a local event system
  const eventBusConnected = true;
  const eventBusError = null;

  // Determine connection type and status
  const hasRealTimeConnection =
    webSocketService.isConnected || eventBusConnected;
  const connectionType: "websocket" | "eventbus" | "none" =
    webSocketService.isConnected
      ? "websocket"
      : eventBusConnected
      ? "eventbus"
      : "none";

  // Show one-time notification when falling back to HTTP
  useEffect(() => {
    if (
      !webSocketService.isConnected &&
      !webSocketService.isConnecting &&
      eventBusConnected &&
      !fallbackNotificationShown.current
    ) {
      fallbackNotificationShown.current = true;
      console.log(
        "[WebSocketProvider] Using HTTP-based messaging for real-time features"
      );
      // You could add a toast notification here if desired:
      // toast.info("Using HTTP-based messaging (WebSocket not available)", { duration: 2000 });
    }
  }, [
    webSocketService.isConnected,
    webSocketService.isConnecting,
    eventBusConnected,
  ]);

  // Enhanced context value with EventBus support
  const {
    sendPrivateMessage: _,
    ...webSocketServiceWithoutSendPrivateMessage
  } = webSocketService;

  const contextValue: WebSocketContextType = {
    // Include all properties from webSocketService except sendPrivateMessage
    ...webSocketServiceWithoutSendPrivateMessage,

    // Override specific properties for better user experience
    isConnected: hasRealTimeConnection,
    isConnecting: webSocketService.isConnecting,
    // Clear error if we have EventBus fallback working
    error: webSocketService.isConnected ? webSocketService.error : null,

    // Override sendPrivateMessage to use EventBus when WebSocket is not available
    sendPrivateMessage: async (
      receiverId: string,
      content: string
    ): Promise<boolean> => {
      if (webSocketService.isConnected) {
        // WebSocket sendPrivateMessage takes (receiverId, content) and returns boolean
        // We need to wrap it in a Promise to match our async signature
        return Promise.resolve(
          webSocketService.sendPrivateMessage(receiverId, content)
        );
      } else {
        // Use EventBus for message handling - this is the HTTP fallback
        console.log(
          "[WebSocketProvider] Using HTTP fallback for message sending"
        );
        return await eventBusSendMessage(receiverId, content);
      }
    },

    // EventBus-specific properties
    eventBusConnected,
    eventBusError,

    // Combined status
    hasRealTimeConnection,
    connectionType,
  } as WebSocketContextType;

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Export the hook
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext must be used within WebSocketProvider"
    );
  }
  return context;
};

// Default export
export default WebSocketProvider;
