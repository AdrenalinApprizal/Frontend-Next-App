import { useState, useCallback } from "react";
import { useSession } from "next-auth/react";

// For measuring performance
function measurePerformance<T extends any[], R>(
  label: string,
  callback: (...args: T) => Promise<R>
): (...args: T) => Promise<R> {
  return async (...args: T) => {
    const start = performance.now();
    try {
      console.log(`[Groups Store] Starting ${label}...`);
      const result = await callback(...args);
      const elapsed = performance.now() - start;
      console.log(
        `[Groups Store] Completed ${label} in ${elapsed.toFixed(2)}ms`
      );
      return result;
    } catch (error) {
      const elapsed = performance.now() - start;
      console.error(
        `[Groups Store] Failed ${label} after ${elapsed.toFixed(2)}ms:`,
        error
      );
      throw error;
    }
  };
}

/**
 * Helper function to extract and format member names consistently
 * @param member Group member object
 * @returns Formatted name string
 */
const extractMemberName = (member: any): string => {
  // Handle case where member is null or undefined
  if (!member) return "Unknown Member";

  // Handle case where user is nested
  if (member.user) {
    return (
      member.user.name ||
      member.user.full_name ||
      member.user.username ||
      member.user.email?.split("@")[0] ||
      "Unknown Member"
    );
  }

  // Handle direct properties
  return (
    member.full_name ||
    member.name ||
    member.username ||
    member.email?.split("@")[0] ||
    `Member ${member.id?.substring(0, 8) || ""}`
  );
};

// Types for group responses
export interface GroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    profile_picture_url?: string;
  };
  full_name?: string;
  username?: string;
  avatar_url?: string;
  is_owner?: boolean;
}

export interface GroupMessage {
  id?: string;
  message_id?: string;
  group_id: string;
  sender_id: string;
  content: string;
  type?: string;
  message_type?: string;
  created_at?: string;
  updated_at?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
  attachment_url?: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

export interface Group {
  id: string;
  name: string;
  avatar_url?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  is_active: boolean;
  member_count: number;
  members: string[];
  last_message?: {
    content: string;
    sender_name: string;
    created_at: string;
  };
  unread_count?: number;
}

export interface GroupsResponse {
  current_page: number;
  page_size: number;
  total: number;
  groups: Group[];
}

export interface GroupMembersResponse {
  group_id: string;
  group_name: string;
  owner_id: string;
  is_active: boolean;
  avatar_url?: string;
  member_ids: string[];
  members: GroupMember[];
  total: number;
}

export interface GroupMessagesResponse {
  current_page: number;
  page_size: number;
  total: number;
  messages: GroupMessage[];
}

export interface SendGroupMessageResponse {
  message_id: string;
  content: string;
  sender_id: string;
  sent_at: string;
  group_id: string;
}

export interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_more_pages: boolean;
}

export interface CreateGroupData {
  name: string;
  description?: string;
  members: string[];
  avatar?: File | null;
}

export interface UpdateGroupData {
  name?: string;
  avatar?: File | null;
  avatar_url?: string;
}

export interface ApiResponse {
  message?: string;
  data?: any;
  pagination?: Pagination;
}

export interface BlockedUser {
  user_id: string;
  blocked_at: string;
  id?: string; // For backward compatibility
  name?: string; // For backward compatibility
}

export const useGroup = () => {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  // Pagination states
  const [messagesPagination, setMessagesPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });

  const [membersPagination, setMembersPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });

  // Base URL for API proxy
  const proxyUrl = "/api/proxy";

  // Helper function for API calls with enhanced error handling and logging
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

    // Delete Content-Type header for FormData requests
    if (options.body instanceof FormData) {
      const headers = mergedOptions.headers as Record<string, string>;
      delete headers["Content-Type"];
    }

    // Fix endpoint path properly
    let formattedEndpoint = endpoint;
    if (!endpoint.startsWith("/") && !endpoint.startsWith("http")) {
      formattedEndpoint = `/${endpoint}`;
    }

    const url = `${proxyUrl}${formattedEndpoint}`;
    console.log(`[Groups Store] Calling API: ${url}`);
    const startTime = performance.now();

    try {
      const response = await fetch(`${proxyUrl}/${endpoint}`, mergedOptions);
      const endTime = performance.now();
      console.log(
        `[Groups Store] API call completed in ${(endTime - startTime).toFixed(
          2
        )}ms`
      );

      // Handle different response formats
      if (!response.ok) {
        console.error(
          `[Groups Store] Error response for ${endpoint}: ${response.status}`
        );

        // For user-facing endpoints that should be resilient, return fallbacks
        if (
          endpoint.includes("groups") &&
          options.method !== "POST" &&
          options.method !== "PUT" &&
          options.method !== "DELETE"
        ) {
          console.log(`[Groups Store] Using fallback for ${endpoint}`);
          if (endpoint.includes("members")) {
            return { members: [] };
          } else if (endpoint.includes("messages")) {
            return { messages: [] };
          } else if (!endpoint.includes("/")) {
            return { groups: [] };
          }
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
        console.log(`[Groups Store] Response for ${endpoint}:`, data);
        return data;
      }

      const text = await response.text();
      console.log(`[Groups Store] Text response for ${endpoint}:`, text);
      return text;
    } catch (err) {
      const endTime = performance.now();
      console.error(
        `[Groups Store] API call failed after ${(endTime - startTime).toFixed(
          2
        )}ms:`,
        err
      );

      // For critical endpoints, provide fallback values to avoid UI failures
      if (
        endpoint.includes("groups") &&
        options.method !== "POST" &&
        options.method !== "PUT" &&
        options.method !== "DELETE"
      ) {
        console.log(
          `[Groups Store] Using fallback for ${endpoint} after error`
        );
        if (endpoint.includes("members")) {
          return { members: [] };
        } else if (endpoint.includes("messages")) {
          return { messages: [] };
        } else if (!endpoint.includes("/")) {
          return { groups: [] };
        }
      }
      throw err;
    }
  };

  /**
   * Get list of groups with enhanced logging and error handling
   */
  const getGroups = useCallback(
    async (page: number = 1, limit: number = 20): Promise<ApiResponse> => {
      console.log(
        `[Groups Store] Fetching groups (page ${page}, limit ${limit})`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        const response = await apiCall(`groups?page=${page}&limit=${limit}`);
        console.log(`[Groups Store] Groups API response:`, response);

        // Extract groups from various response formats
        let groupsList: Group[] = [];
        if (Array.isArray(response)) {
          groupsList = response;
        } else if (response.groups && Array.isArray(response.groups)) {
          groupsList = response.groups;
        } else if (response.data && Array.isArray(response.data)) {
          groupsList = response.data;
        } else if (response && typeof response === "object") {
          // Find the first array property in the response
          const arrayProps = Object.entries(response)
            .filter(([_, value]) => Array.isArray(value))
            .sort(([_, a], [__, b]) =>
              Array.isArray(b)
                ? b.length - (Array.isArray(a) ? a.length : 0)
                : 0
            );

          if (arrayProps.length > 0) {
            const [propName, array] = arrayProps[0];
            console.log(
              `[Groups Store] Found array property '${propName}' in response`,
              array
            );
            groupsList = array as Group[];
          }
        }

        console.log(`[Groups Store] Extracted ${groupsList.length} groups`);
        setGroups(groupsList);

        const endTime = performance.now();
        console.log(
          `[Groups Store] getGroups completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          message: "Groups retrieved successfully",
          data: groupsList,
          pagination: response.pagination,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to get groups after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to get groups: ${err.message}`);
        setLoading(false);

        // Return empty list instead of throwing to improve UI resilience
        setGroups([]);
        return {
          message: `Error: ${err.message}`,
          data: [],
        };
      }
    },
    [session?.access_token]
  );

  /**
   * Create a new group
   */
  const createGroup = useCallback(
    async (groupData: CreateGroupData): Promise<ApiResponse> => {
      setLoading(true);
      setError(null);
      try {
        let response;

        if (groupData.avatar) {
          const formData = new FormData();
          formData.append("name", groupData.name);
          if (groupData.description) {
            formData.append("description", groupData.description);
          }
          groupData.members.forEach((memberId) => {
            formData.append("members[]", memberId);
          });
          formData.append("avatar", groupData.avatar);

          response = await apiCall("groups", {
            method: "POST",
            body: formData,
          });
        } else {
          response = await apiCall("groups", {
            method: "POST",
            body: JSON.stringify({
              name: groupData.name,
              description: groupData.description,
              members: groupData.members,
            }),
          });
        }

        // Refresh groups list
        await getGroups();
        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to create group: ${err.message}`);
        console.error("Error creating group:", err);
        setLoading(false);
        throw err;
      }
    },
    [getGroups, session?.access_token]
  );

  /**
   * Get group details
   */
  const getGroupDetails = useCallback(
    async (groupId: string): Promise<Group> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(`groups/${groupId}`);
        setCurrentGroup(response.data || response);
        setLoading(false);
        return response.data || response;
      } catch (err: any) {
        setError(`Failed to get group details: ${err.message}`);
        console.error(`Error fetching group ${groupId} details:`, err);
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  /**
   * Update group information
   */
  const updateGroup = useCallback(
    async (
      groupId: string,
      updateData: UpdateGroupData
    ): Promise<ApiResponse> => {
      setLoading(true);
      setError(null);
      try {
        let response;

        if (updateData.avatar) {
          const formData = new FormData();
          if (updateData.name) {
            formData.append("name", updateData.name);
          }
          formData.append("avatar", updateData.avatar);

          response = await apiCall(`groups/${groupId}`, {
            method: "PUT",
            body: formData,
          });
        } else {
          response = await apiCall(`groups/${groupId}`, {
            method: "PUT",
            body: JSON.stringify({
              name: updateData.name,
              avatar_url: updateData.avatar_url,
            }),
          });
        }

        // Update current group
        await getGroupDetails(groupId);
        // Refresh groups list
        await getGroups();
        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to update group: ${err.message}`);
        console.error(`Error updating group ${groupId}:`, err);
        setLoading(false);
        throw err;
      }
    },
    [getGroupDetails, getGroups, session?.access_token]
  );

  /**
   * Get list of group members with enhanced name processing
   */
  const getGroupMembers = useCallback(
    async (
      groupId: string,
      page: number = 1
    ): Promise<GroupMembersResponse> => {
      console.log(
        `[Groups Store] Fetching members for group ${groupId} (page ${page})`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        const response = await apiCall(
          `groups/${groupId}/members?page=${page}`
        );
        console.log(
          `[Groups Store] Group members API response for ${groupId}:`,
          response
        );

        // Extract members from various response formats
        let membersList = response.members || response.data || [];

        if (!Array.isArray(membersList)) {
          console.warn(
            `[Groups Store] Unexpected members response format:`,
            response
          );
          membersList = [];

          // Try to find members array in the response object
          if (response && typeof response === "object") {
            // Find the first array property in the response
            const arrayProps = Object.entries(response)
              .filter(([_, value]) => Array.isArray(value))
              .sort(([_, a], [__, b]) =>
                Array.isArray(b)
                  ? b.length - (Array.isArray(a) ? a.length : 0)
                  : 0
              );

            if (arrayProps.length > 0) {
              const [propName, array] = arrayProps[0];
              console.log(
                `[Groups Store] Found array property '${propName}' for members`,
                array
              );
              membersList = array as GroupMember[];
            }
          }
        }

        // Process members to ensure consistent naming
        const processedMembers = membersList.map((member: any) => {
          // Use the extractMemberName helper for consistent name processing
          const memberName = extractMemberName(member);

          // Create enhanced member object
          return {
            ...member,
            full_name: memberName,
            // Ensure these fields are populated for UI consistency
            username:
              member.username ||
              member.user?.username ||
              `user_${member.user_id?.substring(0, 6) || ""}`,
            avatar_url:
              member.avatar_url ||
              member.user?.profile_picture_url ||
              member.user?.avatar_url,
            is_owner:
              member.role === "admin" || member.user_id === response.owner_id,
          };
        });

        console.log(
          `[Groups Store] Processed ${processedMembers.length} members with consistent naming`
        );

        if (page === 1 || page <= 0) {
          setGroupMembers(processedMembers);
        } else {
          // Append new members to existing list for pagination
          setGroupMembers((prevMembers) => [
            ...prevMembers,
            ...processedMembers,
          ]);
        }

        // Update pagination info
        if (response.pagination) {
          setMembersPagination(response.pagination);
        }

        const endTime = performance.now();
        console.log(
          `[Groups Store] getGroupMembers completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          ...response,
          members: processedMembers,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to get group members after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to get group members: ${err.message}`);
        setLoading(false);

        // Return empty list instead of throwing to improve UI resilience
        return {
          group_id: groupId,
          group_name: "Unknown Group",
          owner_id: "",
          is_active: false,
          member_ids: [],
          members: [],
          total: 0,
        };
      }
    },
    [session?.access_token]
  );

  /**
   * Load more members (pagination)
   */
  const loadMoreMembers = useCallback(
    async (groupId: string): Promise<GroupMembersResponse | null> => {
      if (membersPagination.has_more_pages) {
        const nextPage = membersPagination.current_page + 1;
        return getGroupMembers(groupId, nextPage);
      }
      return null;
    },
    [
      membersPagination.has_more_pages,
      membersPagination.current_page,
      getGroupMembers,
    ]
  );

  /**
   * Add members to a group
   */
  const addGroupMembers = useCallback(
    async (
      groupId: string,
      memberIds: string[]
    ): Promise<GroupMembersResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(`groups/${groupId}/members`, {
          method: "POST",
          body: JSON.stringify({
            members: memberIds,
            memberIds: memberIds, // Try both formats for different API implementations
          }),
        });

        // Refresh members list
        await getGroupMembers(groupId);
        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to add group members: ${err.message}`);
        console.error(`Error adding members to group ${groupId}:`, err);
        setLoading(false);
        throw err;
      }
    },
    [getGroupMembers, session?.access_token]
  );

  /**
   * Remove a member from a group
   */
  const removeGroupMember = useCallback(
    async (groupId: string, userId: string): Promise<ApiResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(`groups/${groupId}/members/${userId}`, {
          method: "DELETE",
        });

        // Update local state by removing the member
        setGroupMembers((prevMembers) =>
          prevMembers.filter(
            (member) => member.user_id !== userId && member.id !== userId
          )
        );

        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to remove group member: ${err.message}`);
        console.error(
          `Error removing member ${userId} from group ${groupId}:`,
          err
        );
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  /**
   * Leave a group (for current user)
   */
  const leaveGroup = useCallback(
    async (groupId: string): Promise<ApiResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(`groups/${groupId}/leave`, {
          method: "POST",
          body: JSON.stringify({}),
        });

        // Update local state by removing the group
        setGroups((prevGroups) =>
          prevGroups.filter((group) => group.id !== groupId)
        );

        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to leave group: ${err.message}`);
        console.error(`Error leaving group ${groupId}:`, err);
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  /**
   * Get messages from a group with enhanced logging and error handling
   */
  const getGroupMessages = useCallback(
    async (
      groupId: string,
      page: number = 1,
      limit: number = 20
    ): Promise<GroupMessagesResponse> => {
      console.log(
        `[Groups Store] Fetching messages for group ${groupId} (page ${page}, limit ${limit})`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        const response = await apiCall(
          `groups/${groupId}/messages?page=${page}&limit=${limit}`
        );

        console.log(
          `[Groups Store] Group messages API response for ${groupId}:`,
          response
        );

        // Extract messages from various response formats
        let messagesList: GroupMessage[] = [];

        if (Array.isArray(response)) {
          messagesList = response;
        } else if (response.messages && Array.isArray(response.messages)) {
          messagesList = response.messages;
        } else if (response.data && Array.isArray(response.data)) {
          messagesList = response.data;
        } else if (response && typeof response === "object") {
          // Find the first array property in the response
          const arrayProps = Object.entries(response)
            .filter(([_, value]) => Array.isArray(value))
            .sort(([_, a], [__, b]) =>
              Array.isArray(b)
                ? b.length - (Array.isArray(a) ? a.length : 0)
                : 0
            );

          if (arrayProps.length > 0) {
            const [propName, array] = arrayProps[0];
            console.log(
              `[Groups Store] Found array property '${propName}' in messages response`,
              array
            );
            messagesList = array as GroupMessage[];
          }
        }

        console.log(
          `[Groups Store] Processing ${messagesList.length} messages`
        );

        // Process messages to ensure all required fields
        const processedMessages = messagesList.map((message: any) => {
          // Ensure message has standardized fields
          return {
            ...message,
            // Convert message_id to id if needed
            id: message.id || message.message_id,
            message_id: message.message_id || message.id,
            // Ensure message_type is populated
            message_type: message.message_type || message.type || "text",
            type: message.type || message.message_type || "text",
            // Format timestamps
            created_at:
              message.sent_at || message.created_at || new Date().toISOString(),
            sender: message.sender || {
              id: message.sender_id,
              name: "Unknown User",
            },
          };
        });

        if (page === 1 || page <= 0) {
          setGroupMessages(processedMessages);
        } else {
          // For pagination, older messages are added at the beginning
          setGroupMessages((prevMessages) => [
            ...processedMessages,
            ...prevMessages,
          ]);
        }

        // Update pagination info
        if (response.pagination) {
          setMessagesPagination(response.pagination);
        }

        const endTime = performance.now();
        console.log(
          `[Groups Store] getGroupMessages completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          current_page: page,
          page_size: limit,
          total: response.pagination?.total_items || processedMessages.length,
          messages: processedMessages,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to get group messages after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to get group messages: ${err.message}`);
        setLoading(false);

        // Return empty messages instead of throwing to improve UI resilience
        return {
          current_page: page,
          page_size: limit,
          total: 0,
          messages: [],
        };
      }
    },
    [session?.access_token]
  );

  /**
   * Load more messages (older messages)
   */
  const loadMoreMessages = useCallback(
    async (groupId: string): Promise<GroupMessagesResponse | null> => {
      if (messagesPagination.has_more_pages) {
        const nextPage = messagesPagination.current_page + 1;
        return getGroupMessages(
          groupId,
          nextPage,
          messagesPagination.items_per_page
        );
      }
      return null;
    },
    [
      messagesPagination.has_more_pages,
      messagesPagination.current_page,
      messagesPagination.items_per_page,
      getGroupMessages,
    ]
  );

  /**
   * Send a message to a group with enhanced logging and error handling
   */
  const sendGroupMessage = useCallback(
    async (
      groupId: string,
      content: string,
      messageType: string = "text",
      attachmentUrl?: string
    ): Promise<SendGroupMessageResponse> => {
      console.log(
        `[Groups Store] Sending ${messageType} message to group ${groupId}`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        // Validate input to avoid API errors
        if (!groupId || !content) {
          throw new Error("Group ID and content are required");
        }

        const messageData = {
          content,
          type: messageType,
          attachment_url: attachmentUrl,
          group_id: groupId, // Add group_id to the payload for /messages endpoint
        };

        console.log(`[Groups Store] Message payload:`, messageData);

        const response = await apiCall(`messages`, {
          method: "POST",
          body: JSON.stringify(messageData),
        });

        console.log(`[Groups Store] Message send response:`, response);

        // Optionally update the local messages list to include the new message
        if (response && (response.data || response.message_id)) {
          let newMessage: GroupMessage = {
            id: response.message_id || response.id || response.data?.id,
            message_id: response.message_id || response.id || response.data?.id,
            group_id: groupId,
            sender_id: session?.user?.id || "",
            content: content,
            type: messageType,
            message_type: messageType,
            created_at:
              response.sent_at ||
              response.created_at ||
              new Date().toISOString(),
            sent_at:
              response.sent_at ||
              response.created_at ||
              new Date().toISOString(),
            attachment_url: attachmentUrl,
            sender: {
              id: session?.user?.id || "",
              name: session?.user?.name || "Current User",
              avatar: session?.user?.image,
            },
          };

          setGroupMessages((prevMessages) => [...prevMessages, newMessage]);
        }

        const endTime = performance.now();
        console.log(
          `[Groups Store] sendGroupMessage completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return response;
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to send message after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to send group message: ${err.message}`);
        setLoading(false);

        // Rethrow the error since message sending failures should be handled by the UI
        throw err;
      }
    },
    [
      session?.access_token,
      session?.user?.id,
      session?.user?.name,
      session?.user?.image,
    ]
  );

  /**
   * Send a message with an attachment
   */
  const sendGroupMessageWithAttachment = useCallback(
    async (
      groupId: string,
      content: string,
      type: string,
      attachment: File
    ): Promise<ApiResponse> => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("content", content);
        formData.append("type", type);
        formData.append("group_id", groupId); // Add group_id to FormData
        formData.append("attachment", attachment);

        const response = await apiCall(`messages`, {
          method: "POST",
          body: formData,
        });

        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to send message with attachment: ${err.message}`);
        console.error(
          `Error sending message with attachment to group ${groupId}:`,
          err
        );
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  /**
   * Get blocked users from a group
   */
  const getGroupBlocks = useCallback(
    async (groupId: string, page: number = 1): Promise<ApiResponse> => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiCall(`groups/${groupId}/blocks?page=${page}`);

        console.log(`[Groups Store] Raw getGroupBlocks response:`, response);

        // Handle different response structures
        // API can return: response.blocked_users or response.data.blocked_users or response.data
        let blockedUsersList = [];
        if (response.blocked_users) {
          blockedUsersList = response.blocked_users;
        } else if (response.data?.blocked_users) {
          blockedUsersList = response.data.blocked_users;
        } else if (Array.isArray(response.data)) {
          blockedUsersList = response.data;
        } else if (Array.isArray(response)) {
          blockedUsersList = response;
        }

        console.log(
          `[Groups Store] Processed blocked users list:`,
          blockedUsersList
        );

        setBlockedUsers(blockedUsersList);
        setLoading(false);
        return response;
      } catch (err: any) {
        setError(`Failed to fetch blocked users: ${err.message}`);
        console.error(
          `Error fetching blocked users for group ${groupId}:`,
          err
        );
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  /**
   * Block a user in a group with enhanced logging and error handling
   */
  const blockGroupUser = useCallback(
    async (groupId: string, userId: string): Promise<ApiResponse> => {
      console.log(`[Groups Store] Blocking user ${userId} in group ${groupId}`);
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        // Validate input
        if (!groupId || !userId) {
          throw new Error("Group ID and User ID are required");
        }

        const response = await apiCall(`groups/${groupId}/blocks`, {
          method: "POST",
          body: JSON.stringify({ blocked_user_id: userId }),
        });

        console.log(`[Groups Store] Block user response:`, response);

        // Refresh blocked users list
        await getGroupBlocks(groupId);

        // Also update members list to reflect blocked status
        const updatedMembers = groupMembers.map((member) => {
          if (member.user_id === userId || member.id === userId) {
            return { ...member, is_blocked: true };
          }
          return member;
        });
        setGroupMembers(updatedMembers);

        const endTime = performance.now();
        console.log(
          `[Groups Store] blockGroupUser completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          message: response.message || "User blocked successfully",
          data: response.data || response,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to block user after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to block user in group: ${err.message}`);
        setLoading(false);
        throw err;
      }
    },
    [getGroupBlocks, groupMembers, session?.access_token]
  );

  /**
   * Unblock a user from a group with enhanced logging and error handling
   */
  const unblockGroupUser = useCallback(
    async (groupId: string, userId: string): Promise<ApiResponse> => {
      console.log(
        `[Groups Store] Unblocking user ${userId} in group ${groupId}`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        // Validate input
        if (!groupId || !userId) {
          throw new Error("Group ID and User ID are required");
        }

        const response = await apiCall(`groups/${groupId}/blocks/${userId}`, {
          method: "DELETE",
        });

        console.log(`[Groups Store] Unblock user response:`, response);

        // Update local state for blocked users
        setBlockedUsers((prevBlocked) =>
          prevBlocked.filter(
            (block) => block.user_id !== userId && block.id !== userId
          )
        );

        // Also update members list to reflect unblocked status
        const updatedMembers = groupMembers.map((member) => {
          if (member.user_id === userId || member.id === userId) {
            return { ...member, is_blocked: false };
          }
          return member;
        });
        setGroupMembers(updatedMembers);

        const endTime = performance.now();
        console.log(
          `[Groups Store] unblockGroupUser completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          message: response.message || "User unblocked successfully",
          data: response.data || response,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to unblock user after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to unblock user in group: ${err.message}`);
        setLoading(false);
        throw err;
      }
    },
    [groupMembers, session?.access_token]
  );

  /**
   * Edit a group message with enhanced logging and error handling
   */
  const editGroupMessage = useCallback(
    async (
      groupId: string,
      messageId: string,
      newContent: string
    ): Promise<ApiResponse> => {
      console.log(
        `[Groups Store] Editing message ${messageId} in group ${groupId}`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        // Validate input
        if (!groupId || !messageId || !newContent) {
          throw new Error("Group ID, message ID, and new content are required");
        }

        // Try multiple endpoint patterns for group message editing
        let response;
        let lastError;

        // Option 1: Try generic messages endpoint with group_id (primary method)
        try {
          console.log(
            `[Groups Store] Trying messages endpoint: messages/${messageId}`
          );
          response = await apiCall(`messages/${messageId}`, {
            method: "PUT",
            body: JSON.stringify({
              content: newContent,
              group_id: groupId,
              type: "text",
            }),
          });
          console.log(`[Groups Store] Messages endpoint edit successful:`, response);
        } catch (messagesError) {
          console.log(
            `[Groups Store] Messages endpoint edit failed:`,
            messagesError
          );
          lastError = messagesError;

          // Option 2: Try group-specific endpoint as fallback
          try {
            console.log(
              `[Groups Store] Trying group-specific edit endpoint: groups/${groupId}/messages/${messageId}`
            );
            response = await apiCall(`groups/${groupId}/messages/${messageId}`, {
              method: "PUT",
              body: JSON.stringify({
                content: newContent,
                type: "text",
              }),
            });
            console.log(
              `[Groups Store] Group-specific edit successful:`,
              response
            );
          } catch (groupError) {
            console.log(
              `[Groups Store] Group-specific edit endpoint failed:`,
              groupError
            );
            lastError = groupError;

            // Option 3: Try PATCH method (some APIs prefer PATCH for updates)
            try {
              console.log(
                `[Groups Store] Trying PATCH method: messages/${messageId}`
              );
              response = await apiCall(`messages/${messageId}`, {
                method: "PATCH",
                body: JSON.stringify({
                  content: newContent,
                  group_id: groupId,
                  type: "text",
                }),
              });
              console.log(`[Groups Store] PATCH edit successful:`, response);
            } catch (patchError) {
              console.error(
                `[Groups Store] All edit endpoints failed. Last errors:`,
                {
                  messagesError,
                  groupError,
                  patchError,
                }
              );
              throw patchError;
            }
          }
        }

        console.log(`[Groups Store] Edit message response:`, response);

        // Update the local message list
        setGroupMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId || msg.message_id === messageId
              ? {
                  ...msg,
                  content: newContent,
                  isEdited: true,
                  updated_at: new Date().toISOString(),
                }
              : msg
          )
        );

        // Verify the edit was successful by checking the response status
        if (response && response.success !== false) {
          console.log(
            `[Groups Store] Edit confirmed successful for message ${messageId}`
          );
        } else {
          console.warn(
            `[Groups Store] Edit may not have been successful - response:`,
            response
          );
        }

        const endTime = performance.now();
        console.log(
          `[Groups Store] editGroupMessage completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          message: "Message edited successfully",
          data: response.data || response,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to edit message after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to edit message: ${err.message}`);
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  /**
   * Delete (unsend) a group message with enhanced logging and error handling
   */
  const deleteGroupMessage = useCallback(
    async (groupId: string, messageId: string): Promise<ApiResponse> => {
      console.log(
        `[Groups Store] Deleting message ${messageId} from group ${groupId}`
      );
      setLoading(true);
      setError(null);
      const startTime = performance.now();

      try {
        // Validate input
        if (!groupId || !messageId) {
          throw new Error("Group ID and message ID are required");
        }

        // Try multiple endpoint patterns for group message deletion
        let response;
        let lastError;

        // Option 1: Try generic messages endpoint with group_id in body (primary method)
        try {
          console.log(
            `[Groups Store] Trying messages delete endpoint: messages/${messageId}`
          );
          response = await apiCall(`messages/${messageId}`, {
            method: "DELETE",
            body: JSON.stringify({ group_id: groupId }),
          });
          console.log(
            `[Groups Store] Messages delete successful:`,
            response
          );
        } catch (messagesError) {
          console.log(
            `[Groups Store] Messages delete failed:`,
            messagesError
          );
          lastError = messagesError;

          // Option 2: Try group-specific endpoint as fallback
          try {
            console.log(
              `[Groups Store] Trying group-specific delete endpoint: groups/${groupId}/messages/${messageId}`
            );
            response = await apiCall(`groups/${groupId}/messages/${messageId}`, {
              method: "DELETE",
            });
            console.log(
              `[Groups Store] Group-specific delete successful:`,
              response
            );
          } catch (groupError) {
            console.log(
              `[Groups Store] Group-specific delete endpoint failed:`,
              groupError
            );
            lastError = groupError;

            // Option 3: Try generic messages endpoint with query parameter
            try {
              console.log(
                `[Groups Store] Trying generic delete endpoint with query: messages/${messageId}?group_id=${groupId}`
              );
              response = await apiCall(
                `messages/${messageId}?group_id=${groupId}`,
                {
                  method: "DELETE",
                }
              );
              console.log(
                `[Groups Store] Generic delete with query successful:`,
                response
              );
            } catch (queryError) {
              console.error(
                `[Groups Store] All delete endpoints failed. Last errors:`,
                {
                  messagesError,
                  groupError,
                  queryError,
                }
              );
              throw queryError;
            }
          }
        }

        console.log(`[Groups Store] Delete message response:`, response);

        // Update the local message list
        setGroupMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId || msg.message_id === messageId
              ? {
                  ...msg,
                  content: "",
                  isDeleted: true,
                }
              : msg
          )
        );

        // Verify the delete was successful by checking the response status
        if (response && response.success !== false) {
          console.log(
            `[Groups Store] Delete confirmed successful for message ${messageId}`
          );
        } else {
          console.warn(
            `[Groups Store] Delete may not have been successful - response:`,
            response
          );
        }

        const endTime = performance.now();
        console.log(
          `[Groups Store] deleteGroupMessage completed in ${(
            endTime - startTime
          ).toFixed(2)}ms`
        );

        setLoading(false);
        return {
          message: "Message deleted successfully",
          data: response.data || response,
        };
      } catch (err: any) {
        const endTime = performance.now();
        console.error(
          `[Groups Store] Failed to delete message after ${(
            endTime - startTime
          ).toFixed(2)}ms:`,
          err
        );

        setError(`Failed to delete message: ${err.message}`);
        setLoading(false);
        throw err;
      }
    },
    [session?.access_token]
  );

  return {
    // State
    loading,
    error,
    groups,
    currentGroup,
    groupMembers,
    groupMessages,
    blockedUsers,
    messagesPagination,
    membersPagination,

    // Actions
    getGroups,
    createGroup,
    getGroupDetails,
    updateGroup,
    getGroupMembers,
    loadMoreMembers,
    addGroupMembers,
    removeGroupMember,
    leaveGroup,
    getGroupMessages,
    loadMoreMessages,
    sendGroupMessage,
    sendGroupMessageWithAttachment,
    getGroupBlocks,
    blockGroupUser,
    unblockGroupUser,
    editGroupMessage,
    deleteGroupMessage,
  };
};
