import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import axios from "axios";

// Updated interfaces to match the provided example
export interface User {
  id: string;
  name: string;
  email: string;
  full_name?: string;
  profile_picture_url?: string;
  avatar_url?: string;
  avatar?: string;
  username: string;
  status?: "online" | "offline" | "busy";
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
    const defaultOptions: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      credentials: "include",
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
    console.log(`[Friends API] Calling: ${url}`);

    try {
      const response = await fetch(url, mergedOptions);

      // Handle different response formats
      if (!response.ok) {
        console.error(
          `[Friends API] Error response for ${endpoint}: ${response.status}`
        );

        // For common endpoints that should never fail the UI, return fallback values
        if (endpoint.includes("friends") && !endpoint.includes("add")) {
          console.log(`[Friends API] Using fallback for ${endpoint}`);
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
        console.log(`[Friends API] Response for ${endpoint}:`, data);
        return data.data || data;
      }

      const text = await response.text();
      console.log(`[Friends API] Text response for ${endpoint}:`, text);
      return text;
    } catch (err) {
      console.error(`[Friends API] Fetch error for ${endpoint}:`, err);

      // For critical endpoints, return fallback values to avoid UI failures
      if (endpoint.includes("friends") && !endpoint.includes("add")) {
        console.log(`[Friends API] Using fallback for ${endpoint} after error`);
        return endpoint.includes("requests") ? [] : [];
      }
      throw err;
    }
  };

  // Get list of friends
  const getFriends = async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("[Friends] Fetching friends list...");

      // Try multiple endpoint variations to handle different backend API patterns
      let response;
      const endpoints = ["/friends", "/user/friends", "/users/friends"];
      let successEndpoint = "";

      for (const endpoint of endpoints) {
        try {
          console.log(`[Friends] Trying endpoint: ${endpoint}`);
          response = await apiCall(endpoint, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });
          successEndpoint = endpoint;
          console.log(`[Friends] Success with endpoint: ${endpoint}`);
          break;
        } catch (err) {
          console.log(`[Friends] Failed with endpoint ${endpoint}:`, err);
          // Continue to the next endpoint
        }
      }

      // If all endpoints failed, use an empty array as fallback
      if (!response) {
        console.log(
          "[Friends] All endpoints failed, using empty array fallback"
        );
        setFriends([]);
        setLoading(false);
        return [];
      }

      console.log(
        `[Friends] Raw Friends API Response from ${successEndpoint}:`,
        response
      );

      let friendsList: Array<Partial<User>> = [];

      // Handle various response formats
      if (Array.isArray(response)) {
        console.log("[Friends] Setting friends from array response", response);
        friendsList = response;
      } else if (response && Array.isArray(response.data)) {
        console.log(
          "[Friends] Setting friends from response.data",
          response.data
        );
        friendsList = response.data;
      } else if (
        response &&
        response.friends &&
        Array.isArray(response.friends)
      ) {
        console.log(
          "[Friends] Setting friends from response.friends",
          response.friends
        );
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
          console.log(
            `[Friends] Found array property '${propName}' in response`,
            array
          );
          friendsList = array as Array<Partial<User>>;
        } else {
          console.error("[Friends] Unexpected response format:", response);
          if (response && typeof response === "object") {
            console.log("[Friends] Raw response keys:", Object.keys(response));
          }
          friendsList = [];
        }
      } else {
        console.error("[Friends] Unexpected response format:", response);
        friendsList = [];
      }

      console.log("[Friends] Processing friends list:", friendsList);
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

          // Create a properly formatted Friend object
          const processedFriend: Friend = {
            id: friend.id || "",
            name:
              friend.full_name ||
              friend.name ||
              friend.username ||
              "Unknown User",
            email: friend.email || "",
            username:
              friend.username ||
              friend.name?.toLowerCase().replace(/\s+/g, "_") ||
              "unknown",
            avatar:
              friend.avatar_url || friend.avatar || friend.profile_picture_url,
            status: friend.status || "offline",
            phone: friend.phone || "",
            location: friend.location || "",
            display_name:
              friend.display_name ||
              friend.full_name ||
              friend.name ||
              friend.username ||
              "Unknown User",
            last_seen: lastSeen,
          };

          console.log("[Friends] Processed friend:", processedFriend);
          return processedFriend;
        });

      console.log(
        "[Friends] Setting processed friends list:",
        processedFriends
      );
      setFriends(processedFriends);

      setLoading(false);
      return processedFriends;
    } catch (err: any) {
      console.error("[Friends] Error fetching friends:", err);
      setError(`Failed to get friends: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Get pending friend requests with optional pagination
   */
  const getFriendRequests = async (page?: number) => {
    setLoading(true);
    setError(null);
    try {
      console.log("[Friends] Fetching pending friend requests...");

      const endpoint = page
        ? `/friends/requests?page=${page}`
        : "/friends/requests";
      const response = await apiCall(endpoint);

      console.log("[Friends] Raw friend requests response:", response);
      console.log("[Friends Debug] Response type:", typeof response);
      console.log("[Friends Debug] Is Array:", Array.isArray(response));

      // If response is null or undefined, use an empty array as fallback
      if (!response) {
        console.log(
          "[Friends Debug] Empty response, using empty array fallback"
        );
        setFriendRequests([]);
        setLoading(false);
        return [];
      }

      if (response) {
        console.log("[Friends Debug] Has data property:", "data" in response);
        console.log("[Friends Debug] Response keys:", Object.keys(response));
      }

      // Handle both array responses and responses that have the data property
      if (Array.isArray(response)) {
        console.log("[Friends Debug] Processing array response");
        setFriendRequests(response);
      } else if (response && Array.isArray(response.data)) {
        console.log("[Friends Debug] Processing response.data array");
        setFriendRequests(response.data);
      } else if (
        response &&
        response.requests &&
        Array.isArray(response.requests)
      ) {
        // Added check for response.requests format
        console.log("[Friends Debug] Processing response.requests array");
        setFriendRequests(response.requests);
      } else if (
        response &&
        response.friend_requests &&
        Array.isArray(response.friend_requests)
      ) {
        // Added check for response.friend_requests format
        console.log(
          "[Friends Debug] Processing response.friend_requests array"
        );
        setFriendRequests(response.friend_requests);
      } else if (typeof response === "object" && response !== null) {
        // Last resort: try to extract any array property from the response
        console.log(
          "[Friends Debug] Attempting to find any array in response object"
        );
        let foundArrays = false;

        // Check each property to find arrays
        for (const key in response) {
          if (Array.isArray(response[key])) {
            console.log(`[Friends Debug] Found array in property: ${key}`);
            setFriendRequests(response[key] as FriendRequest[]);
            foundArrays = true;
            break;
          }
        }

        if (!foundArrays) {
          setFriendRequests([]);
          console.error(
            "[Friends] Could not find any array in friend requests response:",
            response
          );
        }
      } else {
        setFriendRequests([]);
        console.error("[Friends] Unexpected friend requests format:", response);
      }

      // Debug the final friendRequests state
      console.log(
        "[Friends Debug] Final friendRequests state:",
        friendRequests
      );

      // If the API supports pagination and returns meta data
      if (response && response.meta) {
        setRequestsPagination(response.meta);
      }

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error("[Friends] Error fetching friend requests:", err.message);
      setError(`Failed to get friend requests: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

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
   * Add a friend by username
   */
  const addFriendByUsername = async (username: string) => {
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
        throw new Error("User not found");
      }

      // Send friend request
      const response = await apiCall("friends/add", {
        method: "POST",
        body: JSON.stringify({ username: username.toLowerCase() }),
      });

      console.log(`[Friends] Successfully sent friend request to ${username}`);
      console.log(`[Friends Debug] Add friend response:`, response);

      // Refresh friend requests with a slight delay to allow backend to process
      setTimeout(async () => {
        try {
          await getFriendRequests();
          console.log(
            "[Friends Debug] Friend requests refreshed after adding friend"
          );
        } catch (refreshErr) {
          console.error(
            "[Friends Debug] Error refreshing requests:",
            refreshErr
          );
        }
      }, 1000);

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error(`[Friends] Error adding friend ${username}:`, err.message);
      setError(`Failed to add friend by username: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Accept a friend request
   */
  const acceptFriendRequest = async (friendshipId: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log("[FriendsHook] Accepting friend request:", friendshipId);

      // 1. Find the friend request before accepting it
      const request = friendRequests.find(
        (req) => req.friendship_id === friendshipId
      );
      if (!request) {
        console.error(
          "[FriendsHook] Could not find friend request with ID:",
          friendshipId
        );
        throw new Error("Friend request not found");
      }

      console.log("[FriendsHook] Found friend request:", request);

      // 2. Accept the friend request
      const acceptResponse = await apiCall("friends/accept", {
        method: "POST",
        body: JSON.stringify({ friendship_id: friendshipId }),
      });
      console.log(
        "[FriendsHook] Friend request accept response:",
        acceptResponse
      );

      // 3. Immediately update the local friend requests state to remove the accepted request
      const updatedRequests = friendRequests.filter(
        (req) => req.friendship_id !== friendshipId
      );
      setFriendRequests(updatedRequests);
      console.log(
        "[FriendsHook] Updated friend requests locally:",
        updatedRequests
      );

      // 4. Add the new friend to the friends list immediately if they were the sender
      if (request.user) {
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
            request.user.avatar_url ||
            request.user.avatar ||
            request.user.profile_picture_url,
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
          console.log("[FriendsHook] Added new friend locally:", newFriend);
        }
      }

      // 5. Refresh both lists from the server to ensure consistency
      try {
        await Promise.all([
          (async () => {
            const requestsResponse = await apiCall("friends/requests");
            if (Array.isArray(requestsResponse)) {
              setFriendRequests(requestsResponse);
            } else if (requestsResponse?.data) {
              setFriendRequests(requestsResponse.data);
            }
          })(),
          (async () => {
            await getFriends(); // Use the improved getFriends function
          })(),
        ]);
        console.log(
          "[FriendsHook] Successfully refreshed both lists from server"
        );
      } catch (refreshError) {
        console.error(
          "[FriendsHook] Error refreshing lists after acceptance:",
          refreshError
        );
        // Don't throw here, as the acceptance was successful
      }

      setLoading(false);
      return acceptResponse;
    } catch (err: any) {
      console.error("[FriendsHook] Error accepting friend request:", err);
      setError(`Failed to accept friend request: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Reject a friend request
   */
  const rejectFriendRequest = async (friendshipId: string) => {
    setLoading(true);
    setError(null);
    try {
      console.log("[FriendsHook] Rejecting friend request:", friendshipId);
      const response = await apiCall("friends/reject", {
        method: "POST",
        body: JSON.stringify({ friendship_id: friendshipId }),
      });
      console.log("[FriendsHook] API response for reject:", response);

      // Immediately update local state for better UX
      const updatedRequests = friendRequests.filter(
        (req) => req.friendship_id !== friendshipId
      );
      setFriendRequests(updatedRequests);

      // Also fetch from API to ensure data consistency
      await getFriendRequests();
      console.log(
        "[FriendsHook] Friend requests updated after rejection, count:",
        friendRequests.length
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      console.error("[FriendsHook] Error rejecting request:", err);
      setError(`Failed to reject friend request: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

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
   * Get all blocked users
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
      setError(`Failed to fetch blocked users: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Block a user
   */
  const blockUser = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/block", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      // Update friends list after blocking
      await getFriends();
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to block user: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Block a user by username
   */
  const blockUserByUsername = async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/block", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      // Update friends list after blocking
      await getFriends();
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to block user by username: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Unblock a user
   */
  const unblockUser = async (userId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/unblock", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      // Update friends list after unblocking
      await getBlockedUsers();
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to unblock user: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Unblock a user by username
   */
  const unblockUserByUsername = async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall("friends/unblock", {
        method: "POST",
        body: JSON.stringify({ username }),
      });

      // Update blocked users list
      await getBlockedUsers();
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to unblock user by username: ${err.message}`);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Search for friends by name, email, or username
   */
  const searchFriends = async (query: string, limit: number = 20) => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = `friends/search?q=${encodeURIComponent(
        query
      )}&limit=${limit}`;
      const response = await apiCall(endpoint);

      // Return results without updating global state
      setLoading(false);
      return response.data || response;
    } catch (err: any) {
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
      console.log("[FriendsHook] Fetching friend by ID:", friendId);

      // First check if friend already exists in our cached list
      const cachedFriend = friends.find((friend) => friend.id === friendId);
      if (cachedFriend) {
        console.log("[FriendsHook] Found friend in cache:", cachedFriend);
        setRecipientData(cachedFriend);
        setLoading(false);
        return cachedFriend;
      }

      // If not in cache, try to get from API
      try {
        const response = await apiCall(`friends/${friendId}`, {
          method: "GET",
        });

        console.log("[FriendsHook] API response for friend by ID:", response);

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
          const formattedFriend: Friend = {
            id: friendData.id || friendId,
            name:
              friendData.full_name ||
              friendData.name ||
              friendData.username ||
              "Unknown",
            email: friendData.email || "",
            username: friendData.username || "",
            avatar:
              friendData.avatar_url ||
              friendData.avatar ||
              friendData.profile_picture_url,
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

          console.log("[FriendsHook] Formatted friend data:", formattedFriend);

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
      console.log("[FriendsHook] Constructing minimal friend data from ID");
      const minimalFriend: Friend = {
        id: friendId,
        name: `User ${friendId.substring(0, 8)}...`,
        email: `user-${friendId}@example.com`,
        username: `user_${friendId.substring(0, 6)}`,
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
    setFriends: setFriendsState, // Expose setFriends method
    setFriendRequests: setFriendRequestsState, // Expose setFriendRequests method
  };
};
