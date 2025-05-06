import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const API_BASE_URL = "http://localhost:8081/api";

// This API route will act as a proxy for all backend requests
// It forwards requests to the backend server and returns the response
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(req, params.path, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(req, params.path, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(req, params.path, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  return handleRequest(req, params.path, "DELETE");
}

async function handleRequest(
  req: NextRequest,
  paths: string[],
  method: string
) {
  try {
    // Get the path to forward to the backend
    const path = paths.join("/");
    const url = `${API_BASE_URL}/${path}`;

    // Get authentication token from the request
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // Prepare headers to forward to the backend
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    // Add authorization header if token exists
    if (token?.access_token) {
      headers["Authorization"] = `Bearer ${token.access_token as string}`;
    }

    // Prepare request options
    const options: RequestInit = {
      method,
      headers,
    };

    // Add body for POST, PUT methods if there is one
    if (method === "POST" || method === "PUT") {
      const contentType = req.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        options.body = JSON.stringify(await req.json());
      } else {
        options.body = await req.text();
      }
    }

    // Forward the request to the backend
    const response = await fetch(url, options);

    // Get response data
    let data: any;
    const responseContentType = response.headers.get("content-type");

    if (responseContentType?.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Create the response with the same status
    if (response.ok) {
      return NextResponse.json(data, { status: response.status });
    } else {
      return NextResponse.json(
        { error: "API Error", details: data },
        { status: response.status }
      );
    }
  } catch (error: any) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: "Proxy Error", message: error.message },
      { status: 500 }
    );
  }
}
