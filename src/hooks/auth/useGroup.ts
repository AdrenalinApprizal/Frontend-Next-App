import { useState } from "react";
import { useSession } from "next-auth/react";

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
  id: string;
  user_id: string;
  name?: string;
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

    // Delete Content-Type header for FormData requests
    if (options.body instanceof FormData) {
      const headers = mergedOptions.headers as Record<string, string>;
      delete headers["Content-Type"];
    }

    const response = await fetch(`${proxyUrl}/${endpoint}`, mergedOptions);

    // Handle different response formats
    if (!response.ok) {
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
      return await response.json();
    }

    return await response.text();
  };

  /**
   * Get list of groups
   */
  const getGroups = async (
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(`groups?page=${page}&limit=${limit}`);
      setGroups(response.groups || response.data || []);
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to get groups: ${err.message}`);
      console.error("Error fetching groups:", err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Create a new group
   */
  const createGroup = async (
    groupData: CreateGroupData
  ): Promise<ApiResponse> => {
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
  };

  /**
   * Get group details
   */
  const getGroupDetails = async (groupId: string): Promise<Group> => {
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
  };

  /**
   * Update group information
   */
  const updateGroup = async (
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
  };

  /**
   * Get list of group members
   */
  const getGroupMembers = async (
    groupId: string,
    page: number = 1
  ): Promise<GroupMembersResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(`groups/${groupId}/members?page=${page}`);

      if (page === 1 || page <= 0) {
        setGroupMembers(response.members || response.data || []);
      } else {
        // Append new members to existing list for pagination
        setGroupMembers((prevMembers) => [
          ...prevMembers,
          ...(response.members || response.data || []),
        ]);
      }

      // Update pagination info
      if (response.pagination) {
        setMembersPagination(response.pagination);
      }

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to get group members: ${err.message}`);
      console.error(`Error fetching members for group ${groupId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Load more members (pagination)
   */
  const loadMoreMembers = async (
    groupId: string
  ): Promise<GroupMembersResponse | null> => {
    if (membersPagination.has_more_pages) {
      const nextPage = membersPagination.current_page + 1;
      return getGroupMembers(groupId, nextPage);
    }
    return null;
  };

  /**
   * Add members to a group
   */
  const addGroupMembers = async (
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
  };

  /**
   * Remove a member from a group
   */
  const removeGroupMember = async (
    groupId: string,
    userId: string
  ): Promise<ApiResponse> => {
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
  };

  /**
   * Leave a group (for current user)
   */
  const leaveGroup = async (groupId: string): Promise<ApiResponse> => {
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
  };

  /**
   * Get messages from a group
   */
  const getGroupMessages = async (
    groupId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<GroupMessagesResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(
        `groups/${groupId}/messages?page=${page}&limit=${limit}`
      );

      if (page === 1 || page <= 0) {
        setGroupMessages(response.messages || response.data || []);
      } else {
        // For pagination, older messages are added at the beginning
        setGroupMessages((prevMessages) => [
          ...(response.messages || response.data || []),
          ...prevMessages,
        ]);
      }

      // Update pagination info
      if (response.pagination) {
        setMessagesPagination(response.pagination);
      }

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to get group messages: ${err.message}`);
      console.error(`Error fetching messages for group ${groupId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Load more messages (older messages)
   */
  const loadMoreMessages = async (
    groupId: string
  ): Promise<GroupMessagesResponse | null> => {
    if (messagesPagination.has_more_pages) {
      const nextPage = messagesPagination.current_page + 1;
      return getGroupMessages(
        groupId,
        nextPage,
        messagesPagination.items_per_page
      );
    }
    return null;
  };

  /**
   * Send a message to a group
   */
  const sendGroupMessage = async (
    groupId: string,
    content: string,
    messageType: string = "text",
    attachmentUrl?: string
  ): Promise<SendGroupMessageResponse> => {
    setLoading(true);
    setError(null);
    try {
      const messageData = {
        content,
        type: messageType,
        attachment_url: attachmentUrl,
      };

      const response = await apiCall(`groups/${groupId}/messages`, {
        method: "POST",
        body: JSON.stringify(messageData),
      });
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to send group message: ${err.message}`);
      console.error(`Error sending message to group ${groupId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Send a message with an attachment
   */
  const sendGroupMessageWithAttachment = async (
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
      formData.append("attachment", attachment);

      const response = await apiCall(`groups/${groupId}/messages`, {
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
  };

  /**
   * Get blocked users from a group
   */
  const getGroupBlocks = async (
    groupId: string,
    page: number = 1
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(`groups/${groupId}/blocks?page=${page}`);

      setBlockedUsers(response.data || []);
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to fetch blocked users: ${err.message}`);
      console.error(`Error fetching blocked users for group ${groupId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Block a user in a group
   */
  const blockGroupUser = async (
    groupId: string,
    userId: string
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(`groups/${groupId}/blocks`, {
        method: "POST",
        body: JSON.stringify({ blocked_user_id: userId }),
      });

      // Refresh blocked users list
      await getGroupBlocks(groupId);
      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to block user in group: ${err.message}`);
      console.error(`Error blocking user ${userId} in group ${groupId}:`, err);
      setLoading(false);
      throw err;
    }
  };

  /**
   * Unblock a user from a group
   */
  const unblockGroupUser = async (
    groupId: string,
    userId: string
  ): Promise<ApiResponse> => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiCall(`groups/${groupId}/blocks/${userId}`, {
        method: "DELETE",
      });

      // Update local state
      setBlockedUsers((prevBlocked) =>
        prevBlocked.filter((block) => block.user_id !== userId)
      );

      setLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to unblock user in group: ${err.message}`);
      console.error(
        `Error unblocking user ${userId} in group ${groupId}:`,
        err
      );
      setLoading(false);
      throw err;
    }
  };

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
  };
};
