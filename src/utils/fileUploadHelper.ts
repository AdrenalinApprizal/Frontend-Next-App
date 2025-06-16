/**
 * File Upload Helper - 2-Step Process (Optimized for Chat)
 * Step 1: Upload file directly to file service via proxy (bypasses useFiles auto-refresh)
 * Step 2: Send message with file attachment to /api/proxy/messages
 *
 * This implementation prevents unnecessary API calls by avoiding the useFiles hook
 * which automatically refreshes the file list after uploads.
 */

export interface FileUploadResult {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileUrl: string;
  messageId?: string;
}

export interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Validate file before upload
 */
export const validateFile = (
  file: File
): { valid: boolean; error?: string } => {
  // File size validation (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: "File size should be less than 10MB" };
  }

  // File type validation
  const allowedTypes = [
    // Images
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "text/csv",
    // Videos
    "video/mp4",
    "video/avi",
    "video/mov",
    "video/wmv",
    "video/webm",
    // Audio
    "audio/mp3",
    "audio/wav",
    "audio/ogg",
    "audio/mpeg",
    // Archives
    "application/zip",
    "application/x-rar-compressed",
    "application/x-7z-compressed",
  ];

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not supported. Please select a valid image, document, video, or audio file.`,
    };
  }

  return { valid: true };
};

/**
 * Step 1: Upload file directly to file service via proxy (bypasses useFiles hook refresh)
 */
export const uploadFileToServer = async (
  file: File,
  recipientId: string,
  isGroup: boolean = false,
  onProgress?: UploadProgressCallback
): Promise<{ fileId: string; fileUrl: string; fileName: string }> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", "attachment");
  formData.append("related_to", recipientId);
  formData.append("related_type", isGroup ? "group" : "user");
  formData.append("for_message", "true");

  // Call the file service directly via proxy to avoid useFiles hook's automatic refresh
  const response = await fetch("/api/proxy/files/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  if (!result.file_id) {
    throw new Error("Invalid file upload response - missing file ID");
  }

  return {
    fileId: result.file_id,
    fileUrl: result.url,
    fileName: result.filename || file.name,
  };
};

/**
 * Step 2: Send message with file attachment to /api/proxy/messages
 */
export const sendMessageWithFile = async (
  recipientId: string,
  fileId: string,
  fileName: string,
  fileUrl: string,
  messageText: string = "",
  isGroup: boolean = false,
  accessToken?: string
): Promise<{ messageId: string; message: any }> => {
  const endpoint = "/api/proxy/messages"; // Use unified messages endpoint for both individual and group chats

  const payload = {
    content: messageText || `📎 ${fileName}`,
    attachment_url: fileUrl,
    type: "file",
    ...(isGroup ? { group_id: recipientId } : { recipient_id: recipientId }),
  };

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  // Add authentication header if access token is provided
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  console.log(`[FileUpload] Step 2 - Sending message to ${endpoint}:`, payload);
  console.log(`[FileUpload] Step 2 - Headers:`, {
    ...headers,
    Authorization: accessToken ? "[REDACTED]" : "Not provided",
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  console.log(`[FileUpload] Step 2 response status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FileUpload] Step 2 failed:`, {
      status: response.status,
      statusText: response.statusText,
      error: errorText,
      endpoint,
      payload,
    });
    throw new Error(`Message send failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json();
  console.log(`[FileUpload] Step 2 success:`, result);

  return {
    messageId: result.data?.id || result.id,
    message: result.data || result,
  };
};

/**
 * Complete 2-step file upload and message send process
 */
export const uploadFileAndSendMessage = async (
  file: File,
  recipientId: string,
  messageText: string = "",
  isGroup: boolean = false,
  onProgress?: UploadProgressCallback,
  accessToken?: string
): Promise<FileUploadResult> => {
  // Validate file first
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  console.log(`[FileUpload] Starting 2-step upload for ${file.name}`);

  try {
    // Step 1: Upload file
    console.log("[FileUpload] Step 1: Uploading file...");
    if (onProgress) onProgress(25);

    const uploadResult = await uploadFileToServer(
      file,
      recipientId,
      isGroup,
      onProgress
    );
    console.log("[FileUpload] Step 1 completed:", uploadResult);

    if (onProgress) onProgress(75);

    // Step 2: Send message with file attachment
    console.log("[FileUpload] Step 2: Sending message with attachment...");
    const messageResult = await sendMessageWithFile(
      recipientId,
      uploadResult.fileId,
      uploadResult.fileName,
      uploadResult.fileUrl,
      messageText,
      isGroup,
      accessToken // Pass the access token for authentication
    );
    console.log("[FileUpload] Step 2 completed:", messageResult);

    if (onProgress) onProgress(100);

    const result: FileUploadResult = {
      fileId: uploadResult.fileId,
      fileName: uploadResult.fileName,
      fileSize: file.size,
      fileType: file.type,
      fileUrl: uploadResult.fileUrl,
      messageId: messageResult.messageId,
    };

    console.log("[FileUpload] Complete 2-step process finished:", result);
    return result;
  } catch (error) {
    console.error("[FileUpload] 2-step process failed:", error);
    throw error;
  }
};

/**
 * Get media type category from MIME type
 */
export const getMediaType = (
  mimeType: string
): "image" | "video" | "audio" | "document" => {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};
