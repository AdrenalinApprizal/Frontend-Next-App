import { getSession, signIn } from "next-auth/react";

// Change to use the local proxy API instead of direct backend URL
const API_BASE_URL = "/api/proxy";

/**
 * Makes an authenticated request to your backend API through the proxy
 * @param endpoint - The API endpoint path (without the base URL)
 * @param options - Fetch options like method, body, etc.
 * @returns The response from your API
 */
export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  // Get the current session to access the token
  const session = await getSession();

  // Build the request URL using the proxy
  const url = `${API_BASE_URL}/${endpoint.replace(/^\/?/, "")}`;

  // Set up headers with authentication token
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Add the auth token if available - use access_token property
  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  // Make the API request through the proxy
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Parse the JSON response if the request was successful
  if (response.ok) {
    // Check if the response has content before parsing as JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const contentLength = response.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 0) {
        return await response.json();
      }
    }
    return {};
  }

  // Handle error responses
  try {
    const errorData = await response.json();
    throw new Error(errorData.message || `API error: ${response.status}`);
  } catch (error) {
    throw new Error(`API error: ${response.status}`);
  }
}

// Convenience methods for common HTTP methods
export const api = {
  get: (endpoint: string, options: RequestInit = {}) =>
    fetchApi(endpoint, { ...options, method: "GET" }),

  post: (endpoint: string, data: any, options: RequestInit = {}) =>
    fetchApi(endpoint, {
      ...options,
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: (endpoint: string, data: any, options: RequestInit = {}) =>
    fetchApi(endpoint, {
      ...options,
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (endpoint: string, options: RequestInit = {}) =>
    fetchApi(endpoint, { ...options, method: "DELETE" }),
};
