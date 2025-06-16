import { useState } from "react";

// Define media type
type MediaType = "image" | "video" | "audio" | "document" | "all";

// Define file metadata interface
export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  shared_with?: string[];
  conversation_id?: string;
  message_id?: string;
}

// Original FileItem interface
export interface FileItem {
  id: string;
  name: string;
  size: number;
  content_type: string;
  url: string;
  uploader_id: string;
  uploaded_at: string;
  access_type: "public" | "private";
  type: "attachment" | "profile" | "avatar";
  related_to?: string;
}

// Define pagination interface
export interface Pagination {
  current_page: number;
  total_pages: number;
  total_items: number;
  items_per_page: number;
  has_more_pages: boolean;
}

// Original FilesResponse interface
export interface FilesResponse {
  files: FileItem[];
  current_page: number;
  page_size: number;
  total: number;
}

// Define API response interface
export interface ApiResponse {
  message?: string;
  data?: any;
  pagination?: Pagination;
}

export interface ShareRequest {
  permission: string; // read, write, etc.
  target_id: string; // user ID or group ID
  target_type: string; // "user" or "group"
}

// Use proper path format for the proxy - no /api/proxy prefix needed since callApi adds it
const FILE_SERVICE_PATH = "";

export const useFiles = () => {
  // State
  const [files, setFiles] = useState<FileMetadata[]>([]);
  const [userMedia, setUserMedia] = useState<FileMetadata[]>([]);
  const [groupMedia, setGroupMedia] = useState<FileMetadata[]>([]);
  const [userFiles, setUserFiles] = useState<FileMetadata[]>([]);
  const [groupFiles, setGroupFiles] = useState<FileMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<Pagination>({
    current_page: 1,
    total_pages: 1,
    total_items: 0,
    items_per_page: 20,
    has_more_pages: false,
  });
  const [filesResponse, setFilesResponse] = useState<FilesResponse | null>(
    null
  );

  // Helper function for API calls
  const callApi = async (endpoint: string, method: string, body?: any) => {
    try {
      const url = `/api/proxy${endpoint}`;
      const options: RequestInit = {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error: any) {
      throw new Error(error.message || "API request failed");
    }
  };

  /**
   * Check if file service is healthy
   */
  const checkHealth = async (): Promise<{ status: string }> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await callApi(`${FILE_SERVICE_PATH}/health`, "GET");
      setIsLoading(false);
      return response;
    } catch (err: any) {
      setError(`Failed to check file service health: ${err.message}`);
      setIsLoading(false);
      throw err;
    }
  };

  /**
   * Get media from a specific user's conversations
   * This retrieves all media files shared in conversations with a specific user
   */
  const getUserMedia = async (
    userId: string,
    type: MediaType = "all",
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct the endpoint URL with query parameters
      const endpoint = `${FILE_SERVICE_PATH}/media/user/${userId}?type=${type}&page=${page}&limit=${limit}`;

      const response = await callApi(endpoint, "GET");

      // Check if the response is valid
      if (!response || !response.data) {
        throw new Error("Invalid response from server");
      }

      // Handle pagination differently based on page number
      if (page === 1) {
        // Replace existing data on first page
        setUserMedia(response.data || []);
      } else {
        // Append data for subsequent pages
        setUserMedia((prevMedia) => [...prevMedia, ...(response.data || [])]);
      }

      // Update pagination if available
      if (response.pagination) {
        setPagination(response.pagination);
      }

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to fetch user media");
      console.error(`Error fetching media for user ${userId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get media from a specific group
   * This retrieves all media files shared in a group chat
   */
  const getGroupMedia = async (
    groupId: string,
    type: MediaType = "all",
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct the endpoint URL with query parameters
      const endpoint = `${FILE_SERVICE_PATH}/media/group/${groupId}?type=${type}&page=${page}&limit=${limit}`;

      const response = await callApi(endpoint, "GET");

      // Check if the response is valid
      if (!response || !response.data) {
        throw new Error("Invalid response from server");
      }

      // Handle pagination differently based on page number
      if (page === 1) {
        // Replace existing data on first page
        setGroupMedia(response.data || []);
      } else {
        // Append data for subsequent pages
        setGroupMedia((prevMedia) => [...prevMedia, ...(response.data || [])]);
      }

      // Update pagination if available
      if (response.pagination) {
        setPagination(response.pagination);
      }

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to fetch group media");
      console.error(`Error fetching media for group ${groupId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get files from a specific user
   */
  const getUserFiles = async (
    userId: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct the endpoint URL with query parameters
      const endpoint = `/files/user/${userId}?page=${page}&limit=${limit}`;

      const response = await callApi(endpoint, "GET");

      // Update state
      setUserFiles(response.data || []);

      // Update pagination if available
      if (response.pagination) {
        setPagination(response.pagination);
      }

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to fetch user files");
      console.error(`Error fetching files for user ${userId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get files from a specific group
   */
  const getGroupFiles = async (
    groupId: string,
    page = 1,
    limit = 20
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct the endpoint URL with query parameters
      const endpoint = `/files/group/${groupId}?page=${page}&limit=${limit}`;

      const response = await callApi(endpoint, "GET");

      // Update state
      setGroupFiles(response.data || []);

      // Update pagination if available
      if (response.pagination) {
        setPagination(response.pagination);
      }

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to fetch group files");
      console.error(`Error fetching files for group ${groupId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get list of all files
   */
  const getAllFiles = async (page = 1, limit = 20): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      // Construct the endpoint URL with query parameters
      const endpoint = `/files?page=${page}&limit=${limit}`;

      const response = await callApi(endpoint, "GET");

      // Update state
      setFiles(response.data || []);

      // Update pagination if available
      if (response.pagination) {
        setPagination(response.pagination);
      }

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to fetch files");
      console.error("Error fetching all files:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Upload a file to the system
   * @param file - The file to upload
   * @param type - File type (attachment, profile, avatar)
   * @param relatedTo - UUID of related entity (optional)
   * @param additionalMetadata - Any other metadata to include
   */
  const uploadFile = async (
    file: File,
    type: "attachment" | "profile" | "avatar" = "attachment",
    relatedTo?: string,
    additionalMetadata?: Record<string, any>
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!file) {
        throw new Error("No file provided");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      // Add related_to if specified
      if (relatedTo) {
        formData.append("related_to", relatedTo);
      }

      // Add any additional metadata as form fields
      if (additionalMetadata) {
        Object.entries(additionalMetadata).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            formData.append(key, String(value));
          }
        });
      }

      const endpoint = `/files/upload`;

      const response = await fetch(`/api/proxy${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      // Safely parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Failed to parse server response");
      }

      // Refresh the files list after a successful upload
      await getAllFiles();

      return data;
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
      console.error("Error uploading file:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Download a file
   */
  const downloadFile = async (fileId: string): Promise<Blob> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!fileId) {
        throw new Error("No file ID provided");
      }

      // For direct download, use the download URL that goes through the proxy
      const url = getFileUrl(fileId);

      // Use browser fetch for direct download (avoiding any response processing)
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to download file (status: ${response.status})`);
      }

      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers.get("content-disposition");
      let filename = fileId;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1];
        }
      }

      // Convert response to blob
      const blob = await response.blob();

      // Create a download link and trigger the download
      if (typeof window !== "undefined") {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }

      return blob;
    } catch (err: any) {
      setError(err.message || "Failed to download file");
      console.error(`Error downloading file ${fileId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Delete a file
   */
  const deleteFile = async (fileId: string): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!fileId) {
        throw new Error("No file ID provided");
      }

      const endpoint = `/files/${fileId}`;

      const response = await callApi(endpoint, "DELETE");

      // Refresh the files list after successful deletion
      await getAllFiles();

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to delete file");
      console.error(`Error deleting file ${fileId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Share a file with another user or group
   */
  const shareFile = async (
    fileId: string,
    userIds: string[],
    permission: string = "read"
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!fileId) {
        throw new Error("No file ID provided");
      }

      if (!userIds || userIds.length === 0) {
        throw new Error("No users specified to share with");
      }

      const endpoint = `/files/${fileId}/share`;

      // Share with the first user in the array
      let response = await callApi(endpoint, "POST", {
        permission: permission,
        target_id: userIds[0],
        target_type: "user",
      });

      // If there are multiple users, make additional API calls
      if (userIds.length > 1) {
        for (let i = 1; i < userIds.length; i++) {
          await callApi(endpoint, "POST", {
            permission: permission,
            target_id: userIds[i],
            target_type: "user",
          });
        }
      }

      return response;
    } catch (err: any) {
      setError(err.message || "Failed to share file");
      console.error(`Error sharing file ${fileId}:`, err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send a file as a message in a chat (direct message)
   * This function handles both upload and message creation in one step
   */
  const sendChatFileMessage = async (
    recipientId: string,
    file: File,
    messageText: string = "File attachment"
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!file) {
        throw new Error("No file provided");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("recipient_id", recipientId);
      formData.append("content", messageText);
      formData.append("type", getFileTypeCategory(file.type));

      const endpoint = `/chat/messages/media`;

      const response = await fetch(`/api/proxy${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      // Safely parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Failed to parse server response");
      }

      // Update user media list with the new file
      await getUserMedia(recipientId, "all", 1);

      return data;
    } catch (err: any) {
      setError(err.message || "Failed to send file message");
      console.error("Error sending file message:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Send a file as a message in a group chat
   * This function handles both upload and message creation in one step
   */
  const sendGroupFileMessage = async (
    groupId: string,
    file: File,
    messageText: string = "File attachment"
  ): Promise<ApiResponse> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!file) {
        throw new Error("No file provided");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("group_id", groupId);
      formData.append("content", messageText);
      formData.append("type", getFileTypeCategory(file.type));

      const endpoint = `/groups/${groupId}/messages`;

      const response = await fetch(`/api/proxy${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed: ${errorText}`);
      }

      // Safely parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (e) {
        throw new Error("Failed to parse server response");
      }

      // Update group media list with the new file
      await getGroupMedia(groupId, "all", 1);

      return data;
    } catch (err: any) {
      setError(err.message || "Failed to send file message");
      console.error("Error sending file message to group:", err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Helper function to determine file type category
   */
  const getFileTypeCategory = (mimeType: string): string => {
    if (!mimeType) return "file";

    if (mimeType.startsWith("image/")) {
      return "image";
    } else if (mimeType.startsWith("video/")) {
      return "video";
    } else if (mimeType.startsWith("audio/")) {
      return "audio";
    } else if (
      mimeType.includes("pdf") ||
      mimeType.includes("doc") ||
      mimeType.includes("xls") ||
      mimeType.includes("ppt") ||
      mimeType.includes("txt")
    ) {
      return "document";
    }

    return "file";
  };

  /**
   * Get file URL (helper function)
   */
  const getFileUrl = (fileId: string, groupId?: string): string => {
    if (!fileId) return "";
    // Construct proper proxy URL without duplicating paths
    if (groupId) {
      return `/api/proxy/files/group/${groupId}/${fileId}`;
    }
    return `/api/proxy/files/${fileId}`;
  };

  /**
   * Get file download URL
   */
  const getDownloadUrl = (fileId: string, groupId?: string): string => {
    if (!fileId) return "";
    if (groupId) {
      return `/api/proxy/files/group/${groupId}/${fileId}/download`;
    }
    return `/api/proxy/files/${fileId}/download`;
  };

  /**
   * Get thumbnail URL for image files (helper function)
   */
  const getThumbnailUrl = (fileId: string, groupId?: string): string => {
    if (!fileId) return "";
    // Add a thumbnail parameter to the URL for the backend to generate a thumbnail
    if (groupId) {
      return `/api/proxy/files/group/${groupId}/${fileId}?thumbnail=true`;
    }
    return `/api/proxy/files/${fileId}?thumbnail=true`;
  };

  /**
   * Format file size for display (helper function)
   */
  const formatFileSize = (bytes: number): string => {
    if (typeof bytes !== "number" || isNaN(bytes) || bytes < 0) {
      return "0 bytes";
    }

    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  /**
   * Get file preview URL
   */
  const getPreviewUrl = (fileId: string, groupId?: string): string => {
    if (groupId) {
      return `/api/proxy/files/group/${groupId}/${fileId}/preview`;
    }
    return `/api/proxy/files/${fileId}/preview`;
  };

  return {
    // State
    files,
    userMedia,
    groupMedia,
    userFiles,
    groupFiles,
    loading: isLoading,
    error,
    pagination,
    filesResponse,

    // Existing methods
    checkHealth,
    getFiles: getAllFiles,
    getUserFiles,
    getGroupFiles,
    getGroupMedia,
    getUserMedia,
    getFileDetails: (fileId: string) => callApi(`/files/${fileId}`, "GET"),
    uploadFile,
    deleteFile,
    shareFile,
    getPreviewUrl,
    getDownloadUrl,
    getFileUrl,
    getThumbnailUrl,

    // New methods from Pinia store
    getAllFiles,
    downloadFile,
    formatFileSize,
    sendChatFileMessage,
    sendGroupFileMessage,
    uploadMessageAttachment: (file: File, chatId: string, isGroup: boolean) => {
      const additionalData: Record<string, string> = {
        type: "attachment",
        related_to: chatId,
        related_type: isGroup ? "group" : "user",
        for_message: "true",
      };
      return uploadFile(file, "attachment", chatId, additionalData);
    },
  };
};
