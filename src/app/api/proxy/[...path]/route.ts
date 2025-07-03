import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

// Base URLs for different services - use environment variables in production
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:8081/api";
const GROUP_API_BASE_URL =
  process.env.GROUP_API_BASE_URL || "http://localhost:8082/api";
const NOTIFICATION_API_BASE_URL =
  process.env.NOTIFICATION_API_BASE_URL || "http://localhost:8083/api";
const FILES_API_BASE_URL =
  process.env.FILES_API_BASE_URL || "http://localhost:8084/api";
const PRESENCE_API_BASE_URL =
  process.env.PRESENCE_API_BASE_URL || "http://localhost:8085/api";

// This API route will act as a proxy for all backend requests
// It forwards requests to the backend server and returns the response
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return handleRequest(req, path, "GET");
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return handleRequest(req, path, "POST");
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return handleRequest(req, path, "PUT");
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  return handleRequest(req, path, "DELETE");
}

async function handleRequest(
  req: NextRequest,
  paths: string[],
  method: string
) {
  try {
    // Get the path to forward to the backend
    const path = paths.join("/");

    // Get the original search params (query string)
    const originalUrl = new URL(req.url);
    const searchParams = originalUrl.search;

    // Enhanced logging for message endpoints to debug issues
    if (path.includes("messages")) {
      // Log detailed query parameters
      const queryParams = Object.fromEntries(
        originalUrl.searchParams.entries()
      );

      // Enhanced message history detection to match Vue.js patterns
      if (
        path.includes("messages") &&
        (path.includes("/history") ||
          path.includes("/private/") ||
          path.includes("/group/") ||
          path === "messages/history") // Add exact match for root history endpoint
      ) {
        // Check if this request has been retried too many times
        const retryCount = parseInt(
          originalUrl.searchParams.get("_retryCount") || "0",
          10
        );

        // If we've already tried too many times, break the loop
        if (retryCount >= 2) {
          return NextResponse.json(
            {
              messages: [],
              data: [],
              success: false,
              error: "Maximum retry attempts reached",
              errorCode: "MAX_RETRIES_EXCEEDED",
            },
            { status: 200 }
          );
        }

        // Only use GET method for messages/history endpoint
        const methodsToTry = ["GET"];

        // Get authentication token
        const token = await getToken({
          req,
          secret: process.env.NEXTAUTH_SECRET,
        });

        // Prepare headers with authentication if available
        const headers: HeadersInit = {};
        if (token?.access_token) {
          headers["Authorization"] = `Bearer ${token.access_token as string}`;
        }
        headers["Content-Type"] = "application/json";

        // Select the appropriate base URL
        const baseUrl = GROUP_API_BASE_URL;
        // CRITICAL FIX: Include search parameters in the URL
        const url = `${baseUrl}/${path}${searchParams}`;

        // Try each method
        for (const methodToTry of methodsToTry) {
          try {
            const options: RequestInit = {
              method: methodToTry,
              headers,
            };

            // Add a timeout for message history requests to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

            options.signal = controller.signal;

            // Make the request with timeout
            const response = await fetch(url, options).finally(() =>
              clearTimeout(timeoutId)
            );

            if (response.ok) {
              const contentType = response.headers.get("content-type");
              if (contentType?.includes("application/json")) {
                const data = await response.json();

                // Create standardized response format regardless of backend API structure
                const formattedData = {
                  messages:
                    data.messages ||
                    data.data ||
                    (Array.isArray(data) ? data : []),
                  data:
                    data.data ||
                    data.messages ||
                    (Array.isArray(data) ? data : []),
                  ...data,
                  success: true,
                };

                return NextResponse.json(formattedData, { status: 200 });
              } else {
                const text = await response.text();
                return NextResponse.json(
                  {
                    messages: [],
                    data: [],
                    text,
                    success: true,
                  },
                  { status: 200 }
                );
              }
            }
          } catch (error) {
            error;
          }
        }

        return NextResponse.json(
          {
            messages: [],
            data: [],
            success: false,
            error: "Could not retrieve message history",
            errorCode: "ALL_METHODS_FAILED",
            pagination: {
              current_page: 1,
              total_pages: 1,
              total_items: 0,
              items_per_page: 20,
              has_more_pages: false,
            },
          },
          { status: 200 }
        );
      }

      // Special handling for UUID paths that may indicate direct message access
      if (paths.length > 1 && /^[0-9a-f-]{36}$/.test(paths[1])) {
        // Special handling for direct message access with UUID - add fallback safety
        if (method === "GET") {
          // Get authentication token
          const token = await getToken({
            req,
            secret: process.env.NEXTAUTH_SECRET,
          });

          // Prepare headers with authentication if available
          const headers: HeadersInit = {};
          if (token?.access_token) {
            headers["Authorization"] = `Bearer ${token.access_token as string}`;
          }
          headers["Content-Type"] = "application/json";

          try {
            // Add a timeout for direct message requests to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            // Use the selected base URL
            const baseUrl = GROUP_API_BASE_URL;
            // CRITICAL FIX: Include search parameters for direct message requests too
            const url = `${baseUrl}/${path}${searchParams}`;

            // Make the request with timeout
            const response = await fetch(url, {
              method,
              headers,
              signal: controller.signal,
            }).finally(() => clearTimeout(timeoutId));

            if (response.ok) {
              const data = await response.json();
              return NextResponse.json(data, { status: 200 });
            } else {
             

              // Return empty data with success status to avoid breaking UI
              return NextResponse.json(
                {
                  message: null,
                  data: null,
                  success: true,
                  _error: `Message with ID ${paths[1]} not found or server error`,
                  _status: response.status,
                },
                { status: 200 }
              );
            }
          } catch (error: any) {

            // Return empty data with success status to avoid breaking UI
            return NextResponse.json(
              {
                message: null,
                data: null,
                success: true,
                _error: error.message || "Error fetching message",
              },
              { status: 200 }
            );
          }
        }
      }
    }

    // Determine which base URL to use based on the endpoint
    const isGroupEndpoint =
      path === "groups" ||
      path.startsWith("groups/") ||
      path.startsWith("group/");
    const isMessagesEndpoint =
      path === "messages" || path.startsWith("messages/");
    const isAuthEndpoint = path === "auth" || path.startsWith("auth/");
    const isNotificationEndpoint =
      path === "notifications" ||
      path.startsWith("notifications/") ||
      path === "notification" ||
      path.startsWith("notification/");

    ({
      isGroupEndpoint,
      isMessagesEndpoint,
      isAuthEndpoint,
      isNotificationEndpoint,
    });

    // Special handling for group messages - redirect to correct endpoint format
    let finalPath = path;

    // Handle group/messages pattern (convert to groups/{groupId}/messages)
    if (path.startsWith("group/") && path.includes("messages")) {
      const pathParts = path.split("/");
      if (
        pathParts.length >= 3 &&
        pathParts[0] === "group" &&
        pathParts[2] === "messages"
      ) {
        const groupId = pathParts[1];
        finalPath = `groups/${groupId}/messages`;
      }
    }

    // Handle groups/{groupId}/messages/{messageId} pattern for PUT/DELETE/PATCH
    if (
      path.includes("groups/") &&
      path.includes("/messages/") &&
      (method === "PUT" || method === "DELETE" || method === "PATCH")
    ) {
      // Extract message ID from groups/{groupId}/messages/{messageId} pattern
      const pathParts = path.split("/");
      const messagesIndex = pathParts.indexOf("messages");
      if (messagesIndex > 0 && pathParts[messagesIndex + 1]) {
        const messageId = pathParts[messagesIndex + 1];
        finalPath = `messages/${messageId}`;
      }
    }

    // Special logging for message ID endpoints to debug the 500 error
    if (
      isMessagesEndpoint &&
      paths.length > 1 &&
      /^[0-9a-f-]{36}$/.test(paths[1])
    ) {
      // Handling specific message request
    }
    const isFilesEndpoint =
      path === "files" ||
      path.startsWith("files/") ||
      path === "media" ||
      path.startsWith("media/");
    const isPresenceEndpoint =
      path === "presence" || path.startsWith("presence/");
    const isWebSocketEndpoint = path === "messages/ws";

    // Check for upgrade header to detect WebSocket connection requests
    const isWebSocketRequest =
      req.headers.get("upgrade")?.toLowerCase() === "websocket";

    // Select the appropriate base URL
    let baseUrl;
    if (
      isGroupEndpoint ||
      isMessagesEndpoint ||
      isWebSocketEndpoint ||
      finalPath.startsWith("messages/")
    ) {
      baseUrl = GROUP_API_BASE_URL;

      // Add special handling for direct message access with UUID
      if (
        (isMessagesEndpoint || finalPath.startsWith("messages/")) &&
        ((paths.length > 1 && /^[0-9a-f-]{36}$/.test(paths[1])) ||
          (finalPath.includes("/") &&
            /^[0-9a-f-]{36}$/.test(finalPath.split("/")[1])))
      ) {
        // Using message API for specific message
      }
    } else if (isNotificationEndpoint) {
      baseUrl = NOTIFICATION_API_BASE_URL;
    } else if (isFilesEndpoint) {
      baseUrl = FILES_API_BASE_URL;
    } else if (isPresenceEndpoint) {
      baseUrl = PRESENCE_API_BASE_URL;
    } else {
      baseUrl = API_BASE_URL;
    }

    // Final URL will be constructed

    // CRITICAL FIX: Include search parameters in all API requests
    const url = `${baseUrl}/${finalPath}${searchParams}`;

    // Special handling for WebSocket connection attempts through the proxy
    if (isWebSocketEndpoint) {
      // WebSocket request detected

      // Prepare headers to forward to the backend
      const headers: HeadersInit = {};

      // Try multiple token sources to ensure authentication works
      // 1. Check URL query parameters first
      const searchParams = new URL(req.url).searchParams;
      const tokenParam = searchParams.get("token");

      // 2. Check authorization header if no token in query
      const authHeader = req.headers.get("authorization");
      let tokenFromHeader = null;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        tokenFromHeader = authHeader.substring(7);
      }

      // 3. Get token from NextAuth session if available
      const sessionToken = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

      // Use the first available token, prioritizing query param (most explicit)
      const effectiveToken =
        tokenParam || tokenFromHeader || sessionToken?.access_token;

      if (effectiveToken) {
        // Found token for WebSocket connection
        // Add token to authorization header
        headers["Authorization"] = `Bearer ${effectiveToken}`;

        // Token added to Authorization header

        // Add other headers that might be relevant
        headers["Content-Type"] = "application/json";
        headers["Accept"] = "application/json";

        // Headers being sent to WebSocket endpoint
      } else {
        // No token found for WebSocket connection
      }

      // Check if this is a Socket.IO polling request
      const isSocketIOPolling =
        searchParams.has("EIO") && searchParams.get("transport") === "polling";
      if (isSocketIOPolling) {
        // Detected Socket.IO polling request
      }

      // For WebSocket requests, provide connection details
      // This will help the client connect directly if needed
      const wsHost = process.env.NEXT_PUBLIC_WEBSOCKET_HOST || "localhost";
      const wsPort = process.env.NEXT_PUBLIC_WEBSOCKET_PORT || "8082";

      // If we detect a WebSocket upgrade request, return helpful connection information
      if (isWebSocketRequest) {
        // WebSocket upgrade request detected
        return NextResponse.json(
          {
            status: "websocket_redirect",
            message: "Please connect directly to the WebSocket server",
            directConnectionUrl: `${url}?${req.url.split("?")[1] || ""}`,
          },
          { status: 200 }
        );
      }

      // Otherwise continue with proxy request

      // Forward the request to backend with token in authorization header
      try {
        const response = await fetch(url, {
          method,
          headers,
        });

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, { status: response.status });
        } else {
          const errorText = await response.text();
          
          return NextResponse.json(
            { error: `WebSocket connection error: ${errorText}` },
            { status: response.status }
          );
        }
      } catch (error) {
        
        return NextResponse.json(
          {
            error: "WebSocket proxy error",
            message: error instanceof Error ? error.message : String(error),
          },
          { status: 500 }
        );
      }
    }

    // Get authentication token from the request
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

    // Prepare headers to forward to the backend
    const headers: HeadersInit = {};

    // Add authorization header if token exists and the endpoint is not auth login
    if (token?.access_token && !path.includes("auth/login")) {
      headers["Authorization"] = `Bearer ${token.access_token as string}`;
    }

    // Check content type to handle FormData for file uploads
    const contentType = req.headers.get("content-type");
    const isFormData = contentType?.includes("multipart/form-data");

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    } else {
      // For FormData requests, pass through the Content-Type header with boundary
      // This is critical for the server to properly parse the multipart form data
      const originalContentType = req.headers.get("content-type");
      if (originalContentType) {
        headers["Content-Type"] = originalContentType;
      }
    }

    // Prepare request options
    const options: RequestInit = {
      method,
      headers,
    };

    // Add body for POST, PUT, PATCH methods if there is one
    if (method === "POST" || method === "PUT" || method === "PATCH") {
      try {
        if (isFormData) {
          // Clone the request for debugging (we can't read the body twice)
          const clonedRequest = req.clone();
          const forwardRequest = req.clone(); // Second clone for forwarding

          // Debug logging only - don't stop processing if this fails
          // Move debug operations to a separate promise chain to avoid blocking
          (async () => {
            try {
            } catch (formDataError) {
              
            }
          })();

          // Create a new fetch request with the cloned request's body
          return fetch(url, {
            method,
            headers,
            body: forwardRequest.body,
            // Use a type assertion to bypass the TypeScript error
            duplex: "half", // Required for ReadableStream body
          } as RequestInit)
            .then(async (response) => {
              // Clone the response before reading its body
              const responseClone = response.clone();

              // Handle the response appropriately
              if (response.ok) {
                try {
                  const data = await response.json();

                  return NextResponse.json(data, { status: response.status });
                } catch (err) {
                  // If not JSON, return text (using the cloned response)
                  const text = await responseClone.text();

                  return new NextResponse(text, { status: response.status });
                }
              } else {
                try {
                  const errorData = await response.json();
                  
                  return NextResponse.json(errorData, {
                    status: response.status,
                  });
                } catch (err) {
                  // Using the cloned response for text if JSON parsing fails
                  const text = await responseClone.text();
                  
                  return NextResponse.json(
                    { error: "API Error", details: text },
                    { status: response.status }
                  );
                }
              }
            })
            .catch((error) => {
              
              return NextResponse.json(
                { error: "Proxy Error", message: error.message },
                { status: 500 }
              );
            });
        } else if (contentType?.includes("application/json")) {
          const jsonBody = await req.json();

          // If we redirected from groups/{groupId}/messages/{messageId} to messages/{messageId},
          // we need to add the group_id to the request body
          if (
            path !== finalPath &&
            path.includes("groups/") &&
            path.includes("/messages/")
          ) {
            const pathParts = path.split("/");
            const groupsIndex = pathParts.indexOf("groups");
            if (groupsIndex >= 0 && pathParts[groupsIndex + 1]) {
              const groupId = pathParts[groupsIndex + 1];
              jsonBody.group_id = groupId;
            }
          }

          options.body = JSON.stringify(jsonBody);
        } else {
          options.body = await req.text();
        }
      } catch (error) {
        
        return NextResponse.json(
          { error: "Proxy Error", message: "Failed to process request body" },
          { status: 400 }
        );
      }
    }

    // Forward the request to the backend
    // Enhanced handling for messages history endpoint
    if (path.includes("messages/history")) {
      // Set a longer timeout for history requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds

      try {
        options.signal = controller.signal; // Add abort signal

        const response = await fetch(url, options).finally(() =>
          clearTimeout(timeoutId)
        );

        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();

            // Create standardized response format regardless of backend API structure
            // This ensures our client code can rely on consistent response format
            const formattedData = {
              messages:
                data.messages || data.data || (Array.isArray(data) ? data : []),
              data:
                data.data || data.messages || (Array.isArray(data) ? data : []),
              ...data,
              success: true,
            };

            return NextResponse.json(formattedData, { status: 200 });
          } else {
            // For non-JSON responses, provide a fallback
            return NextResponse.json(
              { messages: [], data: [] },
              { status: 200 }
            );
          }
        } else {
          

          // Try to parse error response for logging purposes
          let errorMessage = "Unknown error";
          try {
            const errorText = await response.text();
           

            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.message || errorData.error || errorText;
            } catch (jsonError) {
              errorMessage = errorText;
            }
          } catch (textError) {
          }

          // For 404 or other common errors, return empty array with 200 status
          // This prevents UI errors while still logging the actual backend error
          return NextResponse.json(
            {
              messages: [],
              data: [],
              _error: errorMessage, // Include error but with underscore to indicate it's metadata
              _status: response.status,
            },
            { status: 200 }
          );
        }
      } catch (fetchError) {

        // Return fallback for fetch errors as well
        return NextResponse.json(
          {
            messages: [],
            data: [],
            _error:
              fetchError instanceof Error
                ? fetchError.message
                : String(fetchError),
          },
          { status: 200 }
        );
      }
    }

    // Handle message sending specially
    if (path === "messages" && method === "POST") {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();

            // Ensure response has the required structure
            return NextResponse.json(
              {
                ...data,
                success: true,
                data: data?.data || data || { sent: true },
                message: data?.message || "Message sent successfully",
              },
              { status: 200 }
            );
          } else {
            // For non-JSON responses, provide a fallback success response
            return NextResponse.json(
              {
                success: true,
                data: { sent: true },
                message: "Message sent successfully",
              },
              { status: 200 }
            );
          }
        } else {
          // Try to parse error response
          let errorMessage = "Failed to send message";
          try {
            const errorText = await response.text();
            

            try {
              const errorData = JSON.parse(errorText);
              errorMessage = errorData.message || errorData.error || errorText;
            } catch (jsonError) {
              errorMessage = errorText;
            }
          } catch (textError) {
          }

          // Return user-friendly error
          return NextResponse.json(
            {
              success: false,
              error: errorMessage,
            },
            { status: response.status }
          );
        }
      } catch (fetchError) {

        const errorMessage =
          fetchError instanceof Error ? fetchError.message : String(fetchError);
        return NextResponse.json(
          {
            success: false,
            error: errorMessage,
          },
          { status: 500 }
        );
      }
    }

    // Handle auth endpoints (other than login which is handled above)
    if (isAuthEndpoint && path !== "auth/login") {
      try {
        const response = await fetch(url, options);

        if (response.ok) {
          const data = await response.json();
          return NextResponse.json(data, { status: response.status });
        } else {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Authentication failed" }));
          
          return NextResponse.json(errorData, { status: response.status });
        }
      } catch (error) {
        return NextResponse.json(
          { error: "Authentication service unavailable" },
          { status: 503 }
        );
      }
    }

    // Handle special case for friends and friend requests endpoints - provide fallback when error occurs
    if (
      path === "friends" ||
      path === "friends/requests" ||
      path.startsWith("friends/")
    ) {
      try {
        // Special handling for friends/requests endpoint
        if (path === "friends/requests") {
          try {
            const response = await fetch(url, options);

            if (response.ok) {
              const responseContentType = response.headers.get("content-type");
              if (responseContentType?.includes("application/json")) {
                const data = await response.json();

                // Check different possible response formats
                if (Array.isArray(data)) {
                  return NextResponse.json(data, { status: 200 });
                } else if (data && Array.isArray(data.data)) {
                  return NextResponse.json(data, { status: 200 });
                } else if (data && Array.isArray(data.requests)) {
                  return NextResponse.json(
                    { data: data.requests },
                    { status: 200 }
                  );
                } else if (data && Array.isArray(data.friend_requests)) {
                  return NextResponse.json(
                    { data: data.friend_requests },
                    { status: 200 }
                  );
                } else {
                  return NextResponse.json([], { status: 200 });
                }
              } else {
                return NextResponse.json([], { status: 200 });
              }
            } else {
              
              return NextResponse.json([], { status: 200 });
            }
          } catch (error) {
            return NextResponse.json([], { status: 200 });
          }
        }
        // Special handling for main friends list endpoint
        else if (path === "friends") {
          try {
            const response = await fetch(url, options);

            if (response.ok) {
              const responseContentType = response.headers.get("content-type");
              if (responseContentType?.includes("application/json")) {
                const data = await response.json();

                // Check different possible response formats
                if (Array.isArray(data)) {
                  return NextResponse.json(data, { status: 200 });
                } else if (data && Array.isArray(data.data)) {
                  return NextResponse.json(data, { status: 200 });
                } else if (data && Array.isArray(data.friends)) {
                  return NextResponse.json(data.friends, { status: 200 });
                } else {
                  return NextResponse.json([], { status: 200 });
                }
              } else {
                return NextResponse.json([], { status: 200 });
              }
            } else {
              
              return NextResponse.json([], { status: 200 });
            }
          } catch (error) {
            return NextResponse.json([], { status: 200 });
          }
        }

        // For other friend-related endpoints
        const response = await fetch(url, options);

        // Get response data
        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data, { status: 200 });
          } else {
            // If not JSON, return an appropriate fallback
            return NextResponse.json(
              path.includes("search") ? [] : { success: true },
              {
                status: 200,
              }
            );
          }
        } else {
          // For error responses, return appropriate fallbacks with 200 status to prevent UI breakage
          // Return appropriate fallback based on endpoint
          if (path === "friends") {
            return NextResponse.json([], { status: 200 });
          } else if (path === "friends/requests") {
            return NextResponse.json([], { status: 200 });
          } else if (path.includes("search")) {
            return NextResponse.json([], { status: 200 });
          } else if (path.startsWith("friends/")) {
            // Handle friends/{id} endpoint - create a fallback user object
            const friendId = path.split("/")[1]; // Extract the ID from the path

            return NextResponse.json(
              {
                id: friendId,
                name: `User ${friendId.substring(0, 8)}...`,
                email: "",
                username: `user_${friendId.substring(0, 6)}`,
                status: "offline",
                profile_picture_url: null,
                avatar: null,
              },
              { status: 200 }
            );
          } else {
            return NextResponse.json({ success: true }, { status: 200 });
          }
        }
      } catch (error) {
        return NextResponse.json(path.includes("search") ? [] : [], {
          status: 200,
        });
      }
    }

    // Handle special case for presence endpoints - provide fallback when error occurs
    if (path === "presence" || path.startsWith("presence/")) {
      try {
        const response = await fetch(url, options);

        // Get response data
        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data, { status: 200 });
          } else {
            // If not JSON, return an appropriate fallback

            // Provide appropriate fallbacks based on the specific endpoint
            if (path === "presence/status") {
              return NextResponse.json({ success: true }, { status: 200 });
            } else if (path === "presence/users") {
              return NextResponse.json({ users: [] }, { status: 200 });
            } else {
              return NextResponse.json({}, { status: 200 });
            }
          }
        } else {
          // For error responses, provide appropriate fallbacks

          // Return appropriate fallback based on endpoint
          if (path === "presence/status") {
            return NextResponse.json({ success: true }, { status: 200 });
          } else if (path.includes("presence/users")) {
            return NextResponse.json({ users: [] }, { status: 200 });
          } else {
            return NextResponse.json({ success: true }, { status: 200 });
          }
        }
      } catch (error) {

        // Return fallback responses even for exceptions
        if (path === "presence/status") {
          return NextResponse.json({ success: true }, { status: 200 });
        } else if (path.includes("presence/users")) {
          return NextResponse.json({ users: [] }, { status: 200 });
        } else {
          return NextResponse.json({ success: true }, { status: 200 });
        }
      }
    }

    // Handle special case for notifications endpoints - provide fallback when error occurs
    if (path === "notifications" || path.startsWith("notifications/")) {
      try {
        // Special handling for unread-count endpoint
        if (path === "notifications/unread-count") {
          try {
            const response = await fetch(url, options);

            if (response.ok) {
              const responseContentType = response.headers.get("content-type");
              if (responseContentType?.includes("application/json")) {
                const data = await response.json();

                // Check different possible response formats for the count
                if (data && typeof data.count === "number") {
                  return NextResponse.json(data, { status: 200 });
                } else if (data && typeof data.unread_count === "number") {
                  return NextResponse.json(
                    { count: data.unread_count },
                    { status: 200 }
                  );
                } else if (typeof data === "number") {
                  return NextResponse.json({ count: data }, { status: 200 });
                } else {
                  return NextResponse.json({ count: 0 }, { status: 200 });
                }
              } else {
                // For non-JSON responses, try to parse as text and convert to number
                const text = await response.text();
                const num = parseInt(text, 10);
                if (!isNaN(num)) {
                  return NextResponse.json({ count: num }, { status: 200 });
                } else {
                  return NextResponse.json({ count: 0 }, { status: 200 });
                }
              }
            } else {
              
              return NextResponse.json({ count: 0 }, { status: 200 });
            }
          } catch (error) {
            return NextResponse.json({ count: 0 }, { status: 200 });
          }
        }

        // For other notification endpoints
        const response = await fetch(url, options);

        // Get response data
        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data, { status: 200 });
          } else {
            // If not JSON, return an appropriate fallback

            // Provide appropriate fallbacks based on the specific endpoint
            if (path === "notifications") {
              return NextResponse.json([], { status: 200 });
            } else if (path === "notifications/unread-count") {
              return NextResponse.json({ count: 0 }, { status: 200 });
            } else {
              return NextResponse.json({}, { status: 200 });
            }
          }
        } else {
          // For error responses, provide appropriate fallbacks

          // Return appropriate fallback based on endpoint
          if (path === "notifications") {
            return NextResponse.json([], { status: 200 });
          } else if (path === "notifications/unread-count") {
            return NextResponse.json({ count: 0 }, { status: 200 });
          } else if (path.includes("read-all")) {
            return NextResponse.json({ success: true }, { status: 200 });
          } else if (path.includes("/read")) {
            return NextResponse.json({ success: true }, { status: 200 });
          } else {
            return NextResponse.json({}, { status: 200 });
          }
        }
      } catch (error) {

        // Return fallback responses even for exceptions
        if (path === "notifications") {
          return NextResponse.json([], { status: 200 });
        } else if (path === "notifications/unread-count") {
          return NextResponse.json({ count: 0 }, { status: 200 });
        } else {
          return NextResponse.json({ success: true }, { status: 200 });
        }
      }
    }

    // Handle special case for group endpoints - provide fallback when error occurs
    if (path === "groups" || path.startsWith("groups/")) {
      try {
        const response = await fetch(url, options);

        // Get response data
        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data, { status: 200 });
          } else {
            // If not JSON, return an appropriate fallback
            return NextResponse.json(
              path === "groups"
                ? { groups: [], current_page: 1, page_size: 20, total: 0 }
                : {},
              {
                status: 200,
              }
            );
          }
        } else {
          // For error responses, provide appropriate fallbacks

          // Return appropriate fallback based on endpoint
          if (path === "groups") {
            return NextResponse.json(
              { groups: [], current_page: 1, page_size: 20, total: 0 },
              { status: 200 }
            );
          } else if (path.includes("/messages")) {
            return NextResponse.json(
              { messages: [], current_page: 1, page_size: 20, total: 0 },
              { status: 200 }
            );
          } else if (path.includes("/members")) {
            return NextResponse.json(
              { members: [], total: 0 },
              { status: 200 }
            );
          } else {
            // For individual group details
            return NextResponse.json(
              {
                id: path.split("/")[1] || "",
                name: "Group not available",
                members: [],
                member_count: 0,
              },
              { status: 200 }
            );
          }
        }
      } catch (error) {
        if (path === "groups") {
          return NextResponse.json(
            { groups: [], current_page: 1, page_size: 20, total: 0 },
            { status: 200 }
          );
        } else {
          return NextResponse.json({}, { status: 200 });
        }
      }
    }

    // Handle special case for file endpoints - provide fallback when error occurs
    if (
      path === "files" ||
      path.startsWith("files/") ||
      path === "media" ||
      path.startsWith("media/")
    ) {
      try {
        const response = await fetch(url, options);

        // Get response data
        if (response.ok) {
          const responseContentType = response.headers.get("content-type");
          if (responseContentType?.includes("application/json")) {
            const data = await response.json();
            return NextResponse.json(data, { status: 200 });
          } else {
            // If not JSON, return an appropriate fallback
            return NextResponse.json(
              path === "files"
                ? { files: [], current_page: 1, page_size: 20, total: 0 }
                : {},
              {
                status: 200,
              }
            );
          }
        } else {
          // For error responses, provide appropriate fallbacks

          // Return appropriate fallback based on endpoint
          if (path === "files") {
            return NextResponse.json(
              { files: [], current_page: 1, page_size: 20, total: 0 },
              { status: 200 }
            );
          } else if (
            path.startsWith("files/group/") ||
            path.startsWith("files/user/")
          ) {
            return NextResponse.json(
              { files: [], current_page: 1, page_size: 20, total: 0 },
              { status: 200 }
            );
          } else if (path.startsWith("media/")) {
            return NextResponse.json([], { status: 200 });
          } else {
            // For file details or upload results
            return NextResponse.json(
              {
                success: false,
                message: "File service temporarily unavailable",
              },
              { status: 200 }
            );
          }
        }
      } catch (error) {
        if (path === "files") {
          return NextResponse.json(
            { files: [], current_page: 1, page_size: 20, total: 0 },
            { status: 200 }
          );
        } else {
          return NextResponse.json(
            { success: false, message: "File service temporarily unavailable" },
            { status: 200 }
          );
        }
      }
    }

    // For all other endpoints, use standard handling
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
        { error: data.error || "API Error", details: data },
        { status: response.status }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: "Proxy Error", message: error.message },
      { status: 500 }
    );
  }
}
