import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const FILES_API_BASE_URL =
  process.env.FILES_API_BASE_URL || "http://localhost:8084/api";
const GROUP_API_BASE_URL =
  process.env.GROUP_API_BASE_URL || "http://localhost:8082/api";

// Debug endpoint to test what file upload endpoints are available
export async function GET(req: NextRequest) {
  try {
    console.log("[File Upload Debug] Testing available file upload endpoints");

    // Get authentication token
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token?.access_token) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const results = {
      timestamp: new Date().toISOString(),
      tests: [] as any[],
    };

    // Test 1: /files/upload endpoint
    try {
      console.log("[File Upload Debug] Testing FILES_API /files/upload");
      const filesResponse = await fetch(`${FILES_API_BASE_URL}/files/upload`, {
        method: "OPTIONS", // Use OPTIONS to check if endpoint exists
        headers: {
          Authorization: `Bearer ${token.access_token as string}`,
        },
      });

      results.tests.push({
        endpoint: `${FILES_API_BASE_URL}/files/upload`,
        method: "OPTIONS",
        status: filesResponse.status,
        available: filesResponse.status !== 404,
        headers: Object.fromEntries(filesResponse.headers.entries()),
      });
    } catch (error) {
      results.tests.push({
        endpoint: `${FILES_API_BASE_URL}/files/upload`,
        method: "OPTIONS",
        error: error instanceof Error ? error.message : String(error),
        available: false,
      });
    }

    // Test 2: /messages/media endpoint
    try {
      console.log("[File Upload Debug] Testing GROUP_API /messages/media");
      const messagesResponse = await fetch(
        `${GROUP_API_BASE_URL}/messages/media`,
        {
          method: "OPTIONS",
          headers: {
            Authorization: `Bearer ${token.access_token as string}`,
          },
        }
      );

      results.tests.push({
        endpoint: `${GROUP_API_BASE_URL}/messages/media`,
        method: "OPTIONS",
        status: messagesResponse.status,
        available: messagesResponse.status !== 404,
        headers: Object.fromEntries(messagesResponse.headers.entries()),
      });
    } catch (error) {
      results.tests.push({
        endpoint: `${GROUP_API_BASE_URL}/messages/media`,
        method: "OPTIONS",
        error: error instanceof Error ? error.message : String(error),
        available: false,
      });
    }

    // Test 3: /groups/{groupId}/messages endpoint
    try {
      console.log(
        "[File Upload Debug] Testing GROUP_API /groups/{groupId}/messages"
      );
      // Use a test group ID for the debug endpoint
      const testGroupId = "test-group-id";
      const groupResponse = await fetch(
        `${GROUP_API_BASE_URL}/groups/${testGroupId}/messages`,
        {
          method: "OPTIONS",
          headers: {
            Authorization: `Bearer ${token.access_token as string}`,
          },
        }
      );

      results.tests.push({
        endpoint: `${GROUP_API_BASE_URL}/groups/${testGroupId}/messages`,
        method: "OPTIONS",
        status: groupResponse.status,
        available: groupResponse.status !== 404,
        headers: Object.fromEntries(groupResponse.headers.entries()),
      });
    } catch (error) {
      results.tests.push({
        endpoint: `${GROUP_API_BASE_URL}/groups/test-group-id/messages`,
        method: "OPTIONS",
        error: error instanceof Error ? error.message : String(error),
        available: false,
      });
    }

    // Test 4: Check file service health
    try {
      console.log("[File Upload Debug] Testing FILES_API health");
      const healthResponse = await fetch(`${FILES_API_BASE_URL}/health`, {
        headers: {
          Authorization: `Bearer ${token.access_token as string}`,
        },
      });

      const healthData = healthResponse.ok ? await healthResponse.json() : null;

      results.tests.push({
        endpoint: `${FILES_API_BASE_URL}/health`,
        method: "GET",
        status: healthResponse.status,
        available: healthResponse.ok,
        data: healthData,
      });
    } catch (error) {
      results.tests.push({
        endpoint: `${FILES_API_BASE_URL}/health`,
        method: "GET",
        error: error instanceof Error ? error.message : String(error),
        available: false,
      });
    }

    return NextResponse.json({
      message: "File upload endpoints diagnostic complete",
      environment: {
        FILES_API_BASE_URL,
        GROUP_API_BASE_URL,
        NODE_ENV: process.env.NODE_ENV,
      },
      ...results,
    });
  } catch (error) {
    console.error("[File Upload Debug] Unexpected error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
