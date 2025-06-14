import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const WS_BASE_URL = process.env.WS_BASE_URL || "http://localhost:8081"; // Adjust if your WebSocket server is on a different port

export async function GET(req: NextRequest) {
  try {
    // Get the token for authentication
    const token = await getToken({ req });

    if (!token?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return WebSocket connection info
    const wsUrl = process.env.NODE_ENV === 'production' 
      ? `${process.env.WS_BASE_URL || 'wss://your-websocket-server.com'}/ws`
      : `ws://localhost:8081/ws`;
      
    return NextResponse.json({
      ws_url: wsUrl,
      access_token: token.access_token,
      user_id: token.user_id || token.sub,
    });
  } catch (error) {
    console.error("Error in WebSocket API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // Handle WebSocket connection upgrades or other POST operations
    const token = await getToken({ req });

    if (!token?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // For now, return success - implement specific WebSocket logic as needed
    return NextResponse.json({
      success: true,
      message: "WebSocket endpoint ready",
    });
  } catch (error) {
    console.error("Error in WebSocket POST route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
