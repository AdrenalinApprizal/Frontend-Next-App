"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useWebSocket } from "./useWebSocket";

// Membuat tipe untuk WebSocket context
type WebSocketContextType = ReturnType<typeof useWebSocket>;

// Membuat context untuk WebSocket
const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Provider component
export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  // Menggunakan hook WebSocket yang sudah ada dengan autoConnect
  // This ensures WebSocket connection is attempted when the app initializes
  const webSocketService = useWebSocket({
    autoConnect: true, // Automatically attempt connection when provider loads
  });

  // Use effect to ensure connection and log connection status
  React.useEffect(() => {
    // Log connection status for monitoring
    if (webSocketService.isConnected) {
      console.log("[WebSocketProvider] WebSocket already connected");
    } else if (webSocketService.isConnecting) {
      console.log("[WebSocketProvider] WebSocket connection in progress...");
    } else {
      console.log("[WebSocketProvider] Initiating WebSocket connection");
      webSocketService.connect();
    }
  }, [
    webSocketService.isConnected,
    webSocketService.isConnecting,
    webSocketService.connect,
  ]);

  return (
    <WebSocketContext.Provider value={webSocketService}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Custom hook untuk mengakses WebSocket context
export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error(
      "useWebSocketContext harus digunakan dalam WebSocketProvider"
    );
  }
  return context;
};
