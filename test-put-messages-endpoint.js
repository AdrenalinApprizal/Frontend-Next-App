#!/usr/bin/env node

const fetch = require("node-fetch");

console.log("🧪 Testing PUT /messages/{id} Endpoint\n");

// Configuration
const BASE_URL = "http://localhost:3000/api/proxy"; // Through Next.js proxy
const TEST_MESSAGE_ID = "550e8400-e29b-41d4-a716-446655440000";
const EDIT_CONTENT = "This message has been edited via PUT /messages/{id}";

// Mock authentication token (you would get this from a real login)
const MOCK_TOKEN = "Bearer test-token-123";

async function testPutEndpoint() {
  try {
    console.log("=== Testing PUT /messages/{messageId} ===\n");

    const url = `${BASE_URL}/messages/${TEST_MESSAGE_ID}`;
    console.log(`🔍 Testing: PUT ${url}`);

    const requestBody = {
      content: EDIT_CONTENT,
      type: "text",
    };

    console.log("📤 Request body:", JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: MOCK_TOKEN,
      },
      body: JSON.stringify(requestBody),
    });

    const statusText =
      response.status === 200
        ? "✅"
        : response.status === 401
        ? "🔐"
        : response.status === 404
        ? "❌"
        : response.status === 500
        ? "💥"
        : "⚠️";

    console.log(`📥 Response Status: ${response.status} ${statusText}`);
    console.log(
      `📥 Response Headers:`,
      Object.fromEntries(response.headers.entries())
    );

    let responseData;
    const contentType = response.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
      console.log(
        "📥 Response Body (JSON):",
        JSON.stringify(responseData, null, 2)
      );
    } else {
      responseData = await response.text();
      console.log(
        "📥 Response Body (Text):",
        responseData.substring(0, 500) +
          (responseData.length > 500 ? "..." : "")
      );
    }

    console.log("\n=== Analysis ===");

    if (response.status === 200) {
      console.log("✅ Success! The PUT endpoint is working.");
      if (responseData && typeof responseData === "object") {
        console.log("✅ Response is valid JSON.");
        if (responseData.success !== false) {
          console.log("✅ Edit operation appears successful.");
        } else {
          console.log("⚠️  Edit may have failed - check response data.");
        }
      }
    } else if (response.status === 401) {
      console.log("🔐 Unauthorized (expected with mock token)");
      console.log("✅ Endpoint exists and requires authentication.");
    } else if (response.status === 404) {
      console.log("❌ Endpoint not found - routing may be incorrect.");
    } else if (response.status === 405) {
      console.log("❌ Method not allowed - PUT may not be supported.");
    } else if (response.status === 500) {
      console.log("💥 Server error - check backend logs.");
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
    }

    return { status: response.status, data: responseData };
  } catch (error) {
    console.log(`💥 Network Error: ${error.message}`);
    console.log("❌ Could not connect to the API.");
    return { status: 0, error: error.message };
  }
}

async function testDirectBackend() {
  console.log("\n=== Testing Direct Backend (Port 8082) ===\n");

  try {
    const url = `http://localhost:8082/api/messages/${TEST_MESSAGE_ID}`;
    console.log(`🔍 Testing: PUT ${url}`);

    const response = await fetch(url, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: MOCK_TOKEN,
      },
      body: JSON.stringify({
        content: EDIT_CONTENT,
        type: "text",
      }),
    });

    console.log(`📥 Direct Backend Status: ${response.status}`);

    const responseData = await response.text();
    console.log("📥 Direct Backend Response:", responseData.substring(0, 200));
  } catch (error) {
    console.log(`💥 Direct Backend Error: ${error.message}`);
  }
}

async function runAllTests() {
  console.log("🚀 Starting PUT /messages/{id} endpoint tests...\n");

  // Test through Next.js proxy
  const proxyResult = await testPutEndpoint();

  // Test direct backend
  await testDirectBackend();

  console.log("\n=== Summary ===");
  console.log("✅ 200: Success");
  console.log("🔐 401: Unauthorized (expected without valid token)");
  console.log("❌ 404: Endpoint not found");
  console.log("💥 500: Server error");
  console.log("⚠️  Other: Unexpected status");

  console.log("\n=== Next Steps ===");
  console.log("1. If you get 401: Good! Endpoint exists and requires auth");
  console.log("2. If you get 404: Check proxy routing configuration");
  console.log("3. If you get 500: Check backend API implementation");
  console.log(
    "4. If you get 200: Test with real auth token to verify edit works"
  );

  console.log("\n✨ Test completed!");
}

// Run the tests
runAllTests().catch(console.error);
