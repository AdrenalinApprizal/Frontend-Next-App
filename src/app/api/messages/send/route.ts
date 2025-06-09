import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const API_BASE_URL = "http://localhost:8081/api";

export async function POST(req: NextRequest) {
  try {
    // Get the token for authentication
    const token = await getToken({ req });

    if (!token?.access_token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the request body
    const body = await req.json();

    // Forward the request to the backend API (correct endpoint: /messages)
    const response = await fetch(`${API_BASE_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token.access_token}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Backend API error: ${response.status} - ${errorText}`);

      return NextResponse.json(
        {
          error: "Failed to send message",
          details: errorText,
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in messages send API route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
