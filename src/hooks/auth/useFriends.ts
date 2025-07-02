import React, { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";

// Updated interfaces to match the provided example
export interface User {
  id: string;
  name: string;
  email: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  profile_picture_url?: string;
  avatar_url?: string;
  avatar?: string;
  username: string;
  status?: "online" | "offline"; // Updated to only allow 'online' | 'offline'
  phone?: string;
  location?: string;
  display_name?: string;
  created_at?: string;
}

export interface Friend extends User {
  last_seen?: string;
  unread_count?: number;
  display_name?: string;
  full_name?: string;
}

export interface FriendRequest {
  friendship_id: string;
  user: User;
  created_at: string;
  direction?: "incoming" | "outgoing";
  status?: "pending" | "accepted" | "rejected";
  type?: "sent" | "received";
  requestor_id?: string;
  recipient_id?: string;
  id?: string; // Some APIs might return id instead of friendship_id
  friend_id?: string; // Alternative field for user ID
  friend?: User; // Alternative to user
}

export interface SearchResult extends User {
  is_friend: boolean;
}

export interface ApiResponse {
  message: string;
  data?: any;
}

export interface PaginationMeta {
  current_page: number;
  total: number;
  per_page: number;
  last_page: number;
  has_more_pages: boolean;
}

export const useFriendship = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [searchPagination, setSearchPagination] = useState<PaginationMeta>({
    current_page: 1,
    total: 0,
    per_page: 10,
    last_page: 1,
    has_more_pages: false,
  });
  const [requestsPagination, setRequestsPagination] = useState<PaginationMeta>({
    current_page: 1,
    total: 0,
    per_page: 10,
    last_page: 1,
    has_more_pages: false,
  });
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [recipientData, setRecipientData] = useState<Friend | null>(null);

  // Base URL for API proxy
  const proxyUrl = "/api/proxy";

  // Helper function for API calls
  const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    if (!session?.access_token) {
      throw new Error("No authentication token available");
    }

    const defaultOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
      signal: AbortSignal.timeout(30000), // 30 second timeout
    };

    // Add authorization header if session has access_token
    if (session?.access_token) {
      defaultOptions.headers = {
        ...defaultOptions.headers,
        Authorization: `Bearer ${session.access_token}`,
      };
    }

    // Merge default options with provided options
    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    };

    // Fix endpoint path properly
    let formattedEndpoint = endpoint;
    if (!endpoint.startsWith("/") && !endpoint.startsWith("http")) {
      formattedEndpoint = `/${endpoint}`;
    }

    const url = `${proxyUrl}${formattedEndpoint}`;

    try {
      const response = await fetch(url, mergedOptions);

      // Handle different response formats
      if (!response.ok) {
        console.error(
          `[Friends API] Error response for ${endpoint}: ${response.status}`
        );

        // For common endpoints that should never fail the UI, return fallback values
        if (endpoint.includes("friends") && !endpoint.includes("add")) {
          return endpoint.includes("requests") ? [] : [];
        }

        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          throw new Error(
            errorData.message ||
              errorData.error ||
              `API error: ${response.status}`
          );
        } catch (e) {
          throw new Error(text || `API error: ${response.status}`);
        }
      }

      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        return data.data || data;
      }

      const text = await response.text();
      return text;
    } catch (err) {
      console.error(`[Friends API] Fetch error for ${endpoint}:`, err);

      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === "AbortError" || err.name === "TimeoutError") {
          throw new Error(`Request timeout: ${endpoint}`);
        }
        if (err.message.includes("Failed to fetch")) {
          throw new Error(`Network error: ${endpoint}`);
        }
      }

      // For critical endpoints, return fallback values to avoid UI failures
      if (endpoint.includes("friends") && !endpoint.includes("add")) {
        return endpoint.includes("requests") ? [] : [];
      }
      throw err;
    }
  };

  // Get list of friends with enhanced error handling and logging
  const getFriends = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);
    try {
      // Try multiple endpoint variations to handle different backend API patterns
      let response;
      const endpoints = ["/friends", "/user/friends", "/users/friends"];
      let successEndpoint = "";

      for (const endpoint of endpoints) {
        try {
          response = await apiCall(endpoint, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });
          successEndpoint = endpoint;
          break;
        } catch (err) {
          // Continue to the next endpoint
        }
      }

      // If all endpoints failed, use an empty array as fallback
      if (!response) {
        // All endpoints failed, using empty array fallback
        setFriends([]);
        setLoading(false);
        return [];
      }

      let friendsList: Array<Partial<User>> = [];

      // Handle various response formats
      if (Array.isArray(response)) {
        friendsList = response;
      } else if (response && Array.isArray(response.data)) {
        friendsList = response.data;
      } else if (
        response &&
        response.friends &&
        Array.isArray(response.friends)
      ) {
        friendsList = response.friends;
      } else if (response && typeof response === "object") {
        // Try to extract any array property from the response
        const arrayProps = Object.entries(response)
          .filter(([_, value]) => Array.isArray(value))
          .sort(([_, a], [__, b]) =>
            Array.isArray(b) ? b.length - (Array.isArray(a) ? a.length : 0) : 0
          );

        if (arrayProps.length > 0) {
          const [propName, array] = arrayProps[0];

          friendsList = array as Array<Partial<User>>;
        } else {
          console.error("[Friends] Unexpected response format:", response);
          if (response && typeof response === "object") {
          }
          friendsList = [];
        }
      } else {
        console.error("[Friends] Unexpected response format:", response);
        friendsList = [];
      }

      const processedFriends = friendsList
        .filter(
          (friend): friend is Partial<User> =>
            friend !== null && friend !== undefined
        )
        .map((friend) => {
          // Extract last_seen value safely
          let lastSeen: string | undefined;
          if (
            typeof friend === "object" &&
            friend !== null &&
            "last_seen" in friend
          ) {
            lastSeen = String(friend.last_seen || "");
          }

          // Access first and last name safely through type assertion
          const userWithOptionalFields = friend as any;
          const first_name = userWithOptionalFields?.first_name || "";
          const last_name = userWithOptionalFields?.last_name || "";

          // Build full name from components when available
          const full_name =
            first_name && last_name
              ? `${first_name} ${last_name}`
              : friend.full_name || "";

          // Create a properly formatted Friend object
          const processedFriend: Friend = {
            id: friend.id || "",
            name: full_name || friend.name || friend.username || "Unknown User",
            email: friend.email || "",
            username:
              friend.username ||
              friend.name?.toLowerCase().replace(/\s+/g, "_") ||
              "unknown",
            avatar:
              friend.profile_picture_url || friend.avatar_url || friend.avatar,
            profile_picture_url:
              friend.profile_picture_url || friend.avatar_url || friend.avatar,
            status: friend.status || "offline",
            phone: friend.phone || "",
            location: friend.location || "",
            display_name:
              friend.display_name ||
              full_name ||
              friend.name ||
              friend.username ||
              "Unknown User",
            last_seen: lastSeen,
          };

          return processedFriend;
        });

      setFriends(processedFriends);

      setLoading(false);
      return processedFriends;
    } catch (err: any) {
      console.error("[Friends] Error fetching friends:", err);

      // Handle specific error types
      let errorMessage = "Failed to get friends";
      if (
        err?.message?.includes("timeout") ||
        err?.message?.includes("Request timeout")
      ) {
        errorMessage =
          "Request timed out. Please check your connection and try again.";
      } else if (
        err?.message?.includes("Network error") ||
        err?.message?.includes("Failed to fetch")
      ) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (err?.message?.includes("No authentication token")) {
        errorMessage = "Authentication required. Please log in again.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setFriends([]); // Set empty array as fallback
      setLoading(false);
      return [];
    }
  }, [session?.access_token]); // Dependencies: session access token

  /**
   * Get pending friend requests with optional pagination and enhanced logging
   */
  const getFriendRequests = useCallback(
    async (page?: number) => {
      if (!session?.access_token) {
        setLoading(false);
        return [];
      }

      setLoading(true);
      setError(null);
      try {
        const endpoint = page
          ? `/friends/requests?page=${page}`
          : "/friends/requests";
        const response = await apiCall(endpoint);

        // Detailed logging of the response structure

        // If response is null or undefined, use an empty array as fallback
        if (!response) {
          setFriendRequests([]);
          setLoading(false);
          return [];
        }

        if (response) {
        }

        // Handle both array responses and responses that have the data property
        if (Array.isArray(response)) {
          setFriendRequests(response);
        } else if (response && Array.isArray(response.data)) {
          setFriendRequests(response.data);
        } else if (
          response &&
          response.requests &&
          Array.isArray(response.requests)
        ) {
          // Added check for response.requests format
          setFriendRequests(response.requests);
        } else if (
          response &&
          response.friend_requests &&
          Array.isArray(response.friend_requests)
        ) {
          // Added check for response.friend_requests format

          setFriendRequests(response.friend_requests);
        } else if (typeof response === "object" && response !== null) {
          // Last resort: try to extract any array property from the response

          let foundArrays = false;

          // Check each property to find arrays
          for (const key in response) {
            if (Array.isArray(response[key])) {
              setFriendRequests(response[key] as FriendRequest[]);
              foundArrays = true;
              break;
            }
          }

          if (!foundArrays) {
            setFriendRequests([]);
            console.error(
              "[Friends Store] Could not find any array in friend requests response:",
              response
            );
          }
        } else {
          setFriendRequests([]);
          console.error(
            "[Friends Store] Unexpected friend requests format:",
            response
          );
        }

        // Log the final friendRequests state

        // If the API supports pagination and returns meta data
        if (response && response.meta) {
          setRequestsPagination(response.meta);
        }

        setLoading(false);
        return response;
      } catch (err: any) {
        console.error("[Friends] Error fetching friend requests:", err.message);

        // Handle specific error types
        let errorMessage = "Failed to get friend requests";
        if (
          err?.message?.includes("timeout") ||
          err?.message?.includes("Request timeout")
        ) {
          errorMessage =
            "Request timed out. Please check your connection and try again.";
        } else if (
          err?.message?.includes("Network error") ||
          err?.message?.includes("Failed to fetch")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (err?.message?.includes("No authentication token")) {
          errorMessage = "Authentication required. Please log in again.";
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        setFriendRequests([]); // Set empty array as fallback
        setLoading(false);
        return [];
      }
    },
    [session?.access_token]
  ); // Dependencies: session access token

  /**
   * Load more pending requests when pagination is available
   */
  const loadMorePendingRequests = async () => {
    if (!requestsPagination.has_more_pages) {
      return { message: "No more requests to load" };
    }

    const nextPage = requestsPagination.current_page + 1;
    return getFriendRequests(nextPage);
  };

  /**
   * Search for users by query string with pagination
   */
  const searchUsers = async (query: string, page: number = 1) => {
    if (!session?.access_token) {
      setLoading(false);
      return { users: [], pagination: null };
    }

    setLoading(true);
    setError(null);
    try {
      const endpoint = `friends/search?q=${encodeURIComponent(
        query
      )}&page=${page}`;
      const response = await apiCall(endpoint);

      if (page === 1) {
        setSearchResults(response.data || response);
      } else {
        // Append results for pagination
        setSearchResults((prevResults) => [
          ...prevResults,
          ...(response.data || response),
        ]);
      }

      // Update pagination metadata if available
      if (response.meta) {
        setSearchPagination(response.meta);
      }

      setLoading(false);
      return response.data || response;
    } catch (err: any) {
      setError(`Failed to search users: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Load more search results when pagination is available
   */
  const loadMoreSearchResults = async () => {
    if (!searchPagination.has_more_pages) {
      return [];
    }

    const nextPage = searchPagination.current_page + 1;
    return searchUsers("", nextPage);
  };

  /**
   * Send a friend request to another user
   */
  const sendFriendRequest = async (friendId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/add", {
        method: "POST",
        body: JSON.stringify({ friend_id: friendId }),
      });
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send friend request: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Add a friend by username with enhanced error handling and logging
   */
  const addFriendByUsername = useCallback(
    async (username: string) => {
      if (!session?.access_token) {
        throw new Error("Authentication required. Please log in again.");
      }

      setLoading(true);
      setError(null);
      try {
        if (!username) {
          throw new Error("Username is required");
        }

        // Try to find the user first
        const searchResponse = await apiCall(
          `friends/search?username=${encodeURIComponent(username)}`
        );

        if (
          !searchResponse ||
          (!Array.isArray(searchResponse) && !searchResponse.data)
        ) {
          console.error(
            `[Friends Store] User '${username}' not found in search response`
          );
          throw new Error("User not found");
        }

        // Send friend request
        const response = await apiCall("friends/add", {
          method: "POST",
          body: JSON.stringify({ username: username.toLowerCase() }),
        });

        // Force refresh friend requests immediately to update the UI
        try {
          await getFriendRequests();
        } catch (refreshErr) {
          console.error(
            "[Friends Store] Error refreshing requests:",
            refreshErr
          );
          // Don't throw here as the main operation was successful
        }

        setLoading(false);
        return response;
      } catch (err: any) {
        console.error(
          `[Friends Store] Error adding friend ${username}:`,
          err.message
        );

        // Handle specific error types
        let errorMessage = `Failed to add friend ${username}`;
        if (
          err?.message?.includes("timeout") ||
          err?.message?.includes("Request timeout")
        ) {
          errorMessage =
            "Request timed out. Please check your connection and try again.";
        } else if (
          err?.message?.includes("Network error") ||
          err?.message?.includes("Failed to fetch")
        ) {
          errorMessage =
            "Network error. Please check your connection and try again.";
        } else if (err?.message?.includes("Authentication required")) {
          errorMessage = "Authentication required. Please log in again.";
        } else if (err?.message?.includes("User not found")) {
          errorMessage = `User '${username}' not found.`;
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        setLoading(false);
        throw new Error(errorMessage);
      }
    },
    [session?.access_token]
  ); // Dependencies: session access token

  /**
   * Accept a friend request with enhanced error handling
   */
  const acceptFriendRequest = useCallback(
    async (friendshipId: string) => {
      setLoading(true);
      setError(null);
      try {
        // 1. Find the friend request before accepting it
        const request = friendRequests.find(
          (req) => req.friendship_id === friendshipId || req.id === friendshipId
        );

        if (!request) {
          console.error(
            "[Friends Store] Could not find friend request with ID:",
            friendshipId
          );
          console.error(
            "[Friends Store] Available friendship_ids:",
            friendRequests.map((req) => ({
              friendship_id: req.friendship_id,
              id: req.id,
              user: req.user?.username || req.user?.name,
            }))
          );
          console.warn(
            "[Friends Store] BYPASSING validation and trying API call anyway..."
          );
          // Don't throw error, continue with API call
        }

        // 2. Accept the friend request - use the provided ID directly
        const actualId = request?.friendship_id || request?.id || friendshipId;

        let acceptResponse;
        let lastError: any;

        // Try multiple approaches to accept the friend request
        const acceptMethods = [
          // Method 1: Current approach (POST /friends/accept with friendship_id)
          {
            url: "friends/accept",
            method: "POST",
            body: { friendship_id: actualId },
            description: "POST /friends/accept with friendship_id",
          },
          // Method 2: Try with 'id' field instead
          {
            url: "friends/accept",
            method: "POST",
            body: { id: actualId },
            description: "POST /friends/accept with id",
          },
          // Method 3: Try with request_id field
          {
            url: "friends/accept",
            method: "POST",
            body: { request_id: actualId },
            description: "POST /friends/accept with request_id",
          },
          // Method 4: Try PUT method
          {
            url: "friends/accept",
            method: "PUT",
            body: { friendship_id: actualId },
            description: "PUT /friends/accept with friendship_id",
          },
          // Method 5: Try URL parameter approach
          {
            url: `friends/${actualId}/accept`,
            method: "POST",
            body: {},
            description: "POST /friends/{id}/accept",
          },
        ];

        for (const method of acceptMethods) {
          try {
            acceptResponse = await apiCall(method.url, {
              method: method.method,
              body:
                Object.keys(method.body).length > 0
                  ? JSON.stringify(method.body)
                  : undefined,
            });

            break; // Success! Exit the loop
          } catch (err: any) {
            lastError = err;
            continue; // Try next method
          }
        }

        // If all methods failed, throw the last error
        if (!acceptResponse) {
          console.error(
            "[Friends Store] All accept methods failed, throwing last error"
          );
          throw (
            lastError || new Error("All friend request accept methods failed")
          );
        }

        // 3. Immediately update the local friend requests state to remove the accepted request
        const updatedRequests = friendRequests.filter(
          (req) => req.friendship_id !== actualId && req.id !== actualId
        );
        setFriendRequests(updatedRequests);

        // 4. Add the new friend to the friends list immediately if they were the sender
        if (request && request.user) {
          const newFriend: Friend = {
            id: request.user.id,
            name:
              request.user.full_name ||
              request.user.name ||
              request.user.username ||
              "Unknown User",
            email: request.user.email || "",
            username: request.user.username || "",
            avatar:
              request.user.profile_picture_url ||
              request.user.avatar_url ||
              request.user.avatar,
            profile_picture_url:
              request.user.profile_picture_url ||
              request.user.avatar_url ||
              request.user.avatar,
            status: request.user.status || "offline",
            phone: request.user.phone || "",
            location: request.user.location || "",
            display_name:
              request.user.display_name ||
              request.user.name ||
              request.user.username ||
              "Unknown User",
          };

          // Only add if not already in friends list
          if (!friends.some((f) => f.id === newFriend.id)) {
            const updatedFriends = [...friends, newFriend];
            setFriends(updatedFriends);
          }
        } else {
        }

        // 5. Refresh both lists from the server to ensure consistency (like Vue implementation)
        try {
          await Promise.all([getFriendRequests(), getFriends()]);
        } catch (refreshError) {
          console.error(
            "[Friends Store] Error refreshing lists after acceptance:",
            refreshError
          );
          // Don't throw here, as the acceptance was successful
        }

        setLoading(false);
        return acceptResponse;
      } catch (err: any) {
        console.error("[Friends Store] Error accepting friend request:", err);
        setError(`Failed to accept friend request: ${err.message}`);
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  ); // Dependencies: session access token

  /**
   * Reject a friend request with enhanced logging
   */
  const rejectFriendRequest = useCallback(
    async (friendshipId: string) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall("friends/reject", {
          method: "POST",
          body: JSON.stringify({ friendship_id: friendshipId }),
        });

        // Immediately update local state for better UX
        const updatedRequests = friendRequests.filter(
          (req) => req.friendship_id !== friendshipId
        );
        setFriendRequests(updatedRequests); // Fetch from API to ensure data consistency (like Vue implementation)
        try {
          await getFriendRequests();
        } catch (refreshErr) {
          console.error(
            "[Friends Store] Error refreshing requests after rejection:",
            refreshErr
          );
          // Don't throw here as the main operation was successful
        }

        setLoading(false);
        return response;
      } catch (err: any) {
        console.error("[Friends Store] Error rejecting request:", err);
        setError(`Failed to reject friend request: ${err.message}`);
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  ); // Dependencies: session access token

  /**
   * Remove a friend
   */
  const removeFriend = async (friendId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(`friends/${friendId}`, {
        method: "DELETE",
      });

      // Update friends list after removing
      await getFriends();
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to remove friend: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get all blocked users with enhanced error handling and logging
   */
  const getBlockedUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/blocked", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const blockedList = Array.isArray(response)
        ? response
        : response?.data
        ? response.data
        : response?.blocked_users
        ? response.blocked_users
        : [];
      setBlockedUsers(blockedList);
      setLoading(false);
      return blockedList;
    } catch (err: any) {
      console.error(
        "[Friends Store] Error fetching blocked users:",
        err.message
      );
      setError(`Failed to fetch blocked users: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Block a user with enhanced logging
   */
  const blockUser = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/block", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      // Update friends list after blocking to reflect changes
      await getFriends();
      // Also update blocked users list
      await getBlockedUsers();

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error("[Friends Store] Error blocking user:", err.message);
      setError(`Failed to block user: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Block a user by username with enhanced logging
   */
  const blockUserByUsername = async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/block", {
        method: "POST",
        body: JSON.stringify({ username }),
      }); // Update friends list after blocking
      await getFriends();
      // Also update blocked users list
      await getBlockedUsers();

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error(
        "[Friends Store] Error blocking user by username:",
        err.message
      );
      setError(`Failed to block user by username: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Unblock a user with enhanced logging
   */
  const unblockUser = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/unblock", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      // Update blocked users list after unblocking
      await getBlockedUsers();
      // Also refresh friends list to reflect changes
      await getFriends();

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error("[Friends Store] Error unblocking user:", err.message);
      setError(`Failed to unblock user: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Unblock a user by username with enhanced logging
   */
  const unblockUserByUsername = async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/unblock", {
        method: "POST",
        body: JSON.stringify({ username }),
      }); // Update blocked users list
      await getBlockedUsers();
      // Also refresh friends list to reflect changes
      await getFriends();

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error(
        "[Friends Store] Error unblocking user by username:",
        err.message
      );
      setError(`Failed to unblock user by username: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Search for friends by name, email, or username with enhanced logging
   */
  const searchFriends = async (query: string, limit: number = 20) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = `friends/search?q=${encodeURIComponent(
        query
      )}&limit=${limit}`;

      const response = await apiCall(endpoint);

      // Extract appropriate data from response
      const results = response.data || response;
      Array.isArray(results) ? results.length : "not an array";

      // Return results without updating global state (like Vue implementation)
      setLoading(false);
      return results;
    } catch (err: any) {
      console.error(`[Friends Store] Error searching friends:`, err);
      setError(`Failed to search friends: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get a friend by their ID
   */
  const getFriendById = async (friendId: string) => {
    if (!friendId) {
      console.error("[FriendsHook] Invalid friendId provided:", friendId);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      // First check if friend already exists in our cached list
      const cachedFriend = friends.find((friend) => friend.id === friendId);
      if (cachedFriend) {
        setRecipientData(cachedFriend);
        setLoading(false);
        return cachedFriend;
      }

      // If not in cache, try to get from API
      try {
        const response = await apiCall(`friends/${friendId}`, {
          method: "GET",
        });

        // Add comprehensive logging for friend by ID response
        ({
          responseType: typeof response,
          responseKeys:
            response && typeof response === "object"
              ? Object.keys(response)
              : "not an object",
          hasDataField: !!response?.data,
          dataType: response?.data ? typeof response.data : "no data",
          dataKeys:
            response?.data && typeof response.data === "object"
              ? Object.keys(response.data)
              : "no data keys",
          rawData: response?.data || response,
          profilePictureFields: {
            "response.data.profile_picture_url":
              response?.data?.profile_picture_url,
            "response.data.avatar_url": response?.data?.avatar_url,
            "response.data.avatar": response?.data?.avatar,
            "response.profile_picture_url": response?.profile_picture_url,
            "response.avatar_url": response?.avatar_url,
            "response.avatar": response?.avatar,
          },
        });

        response?.data ? Object.keys(response.data) : "No data field";
        ({
          profile_picture_url_exists: !!response?.data?.profile_picture_url,
          profile_picture_url_length:
            response?.data?.profile_picture_url?.length || 0,
          profile_picture_url_type: typeof response?.data?.profile_picture_url,
          profile_picture_url_starts_with_data:
            response?.data?.profile_picture_url?.startsWith?.("data:") || false,
        });

        // Process the response based on the format
        let friendData = null;

        if (response.data) {
          friendData = response.data;
        } else if (response.friend) {
          friendData = response.friend;
        } else if (typeof response === "object" && response !== null) {
          // If the response itself might be the friend object
          friendData = response;
        }

        // Format the friend object if we found data
        if (friendData) {
          // Access first and last name safely through type assertion
          const friendDataAny = friendData as any;
          const first_name = friendDataAny?.first_name || "";
          const last_name = friendDataAny?.last_name || "";
          const full_name =
            first_name && last_name
              ? `${first_name} ${last_name}`
              : friendData.full_name || "";

          const formattedFriend: Friend = {
            id: friendData.id || friendId,
            name:
              full_name || friendData.name || friendData.username || "Unknown",
            email: friendData.email || "",
            username: friendData.username || "",
            avatar:
              friendData.profile_picture_url ||
              friendData.avatar_url ||
              friendData.avatar,
            profile_picture_url:
              friendData.profile_picture_url ||
              friendData.avatar_url ||
              friendData.avatar,
            status: friendData.status || "offline",
            phone: friendData.phone || "",
            location: friendData.location || "",
            display_name:
              friendData.display_name ||
              friendData.name ||
              friendData.username ||
              "Unknown",
            full_name:
              friendData.full_name ||
              friendData.name ||
              friendData.username ||
              "Unknown",
          };

          ({
            original_profile_picture_url: friendData.profile_picture_url,
            original_avatar_url: friendData.avatar_url,
            original_avatar: friendData.avatar,
            final_avatar: formattedFriend.avatar,
            final_profile_picture_url: formattedFriend.profile_picture_url,
            avatar_is_base64:
              formattedFriend.avatar?.startsWith?.("data:") || false,
            profile_picture_url_is_base64:
              formattedFriend.profile_picture_url?.startsWith?.("data:") ||
              false,
          });

          // Set recipient data
          setRecipientData(formattedFriend);

          // Add to local cache
          setFriends((prev) => {
            // Check if already exists in the list
            const exists = prev.some((f) => f.id === formattedFriend.id);
            if (!exists) {
              return [...prev, formattedFriend];
            }
            return prev;
          });

          setLoading(false);
          return formattedFriend;
        }
      } catch (apiError) {
        console.error("[FriendsHook] API error fetching friend:", apiError);
        // Fall through to try alternate methods
      }

      // If API fails, try to construct a minimal friend object from the ID
      const minimalFriend: Friend = {
        id: friendId,
        name: `User ${friendId.substring(0, 8)}...`,
        email: `user-${friendId}@example.com`,
        username: `user_${friendId.substring(0, 6)}`,
        avatar: undefined,
        profile_picture_url: undefined,
        status: "offline",
        phone: "",
        location: "",
        display_name: `User ${friendId.substring(0, 8)}...`,
        full_name: `User ${friendId.substring(0, 8)}...`,
      };

      setRecipientData(minimalFriend);
      setLoading(false);
      return minimalFriend;
    } catch (err: any) {
      console.error("[FriendsHook] Error fetching friend by ID:", err);
      setError(`Failed to get friend by ID: ${err.message}`);
      setLoading(false);

      // Return minimal data in case of error
      const fallbackFriend: Friend = {
        id: friendId,
        name: `User ${friendId.substring(0, 8)}...`,
        email: `user-${friendId}@example.com`,
        username: `user_${friendId.substring(0, 6)}`,
        avatar: undefined,
        profile_picture_url: undefined,
        status: "offline",
        phone: "",
        location: "",
        display_name: `User ${friendId.substring(0, 8)}...`,
        full_name: `User ${friendId.substring(0, 8)}...`,
      };
      setRecipientData(fallbackFriend);
      return fallbackFriend;
    }
  };

  // New function to get friend details
  const getFriendDetails = useCallback(
    async (friendId: string) => {
      if (!session?.user) return null;

      try {
        const response = await axios.get(`/api/friends/${friendId}`, {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const friendData = response.data.friend;
        setSelectedFriend(friendData);
        return friendData;
      } catch (err: any) {
        console.error("[useFriendship] Error fetching friend details:", err);
        return null;
      }
    },
    [session?.user]
  );

  const setFriendsState = (updatedFriends: Friend[]) => {
    setFriends(updatedFriends);
  };

  const setFriendRequestsState = (updatedRequests: FriendRequest[]) => {
    setFriendRequests(updatedRequests);
  };

  // Add useEffect to handle loading timeout and prevent stuck states
  React.useEffect(() => {
    if (loading) {
      // Set a timeout to prevent getting stuck in loading state
      const timeoutId = setTimeout(() => {
        console.warn(
          "[Friends Store] Loading timeout reached, resetting loading state"
        );
        setLoading(false);
        if (!friends.length && !friendRequests.length) {
          setError("Request took too long. Please refresh and try again.");
        }
      }, 30000); // 30 seconds timeout

      return () => clearTimeout(timeoutId);
    }
  }, [loading, friends.length, friendRequests.length]);

  return {
    loading,
    error,
    friends,
    friendRequests,
    searchResults,
    blockedUsers,
    selectedFriend,
    recipientData,
    setRecipientData,
    getFriends,
    getFriendRequests,
    searchUsers,
    addFriendByUsername,
    acceptFriendRequest,
    rejectFriendRequest,
    searchFriends,
    getFriendById,
    getFriendDetails,
    getBlockedUsers, // Add new functions to the returned object
    blockUser, // Add new functions to the returned object
    blockUserByUsername, // Add new functions to the returned object
    unblockUser, // Add new functions to the returned object
    unblockUserByUsername, // Add new functions to the returned object
    setFriends: setFriendsState,
    setFriendRequests: setFriendRequestsState,
  };
};
