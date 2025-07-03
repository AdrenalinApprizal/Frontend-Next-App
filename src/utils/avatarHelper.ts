/**
 * Helper utility for handling avatar URLs consistently across the application
 */

/**
 * Transform avatar URLs to ensure they work correctly with the frontend proxy
 * @param url - The avatar URL to transform
 * @returns Transformed URL or empty string if invalid
 */
export const getAvatarUrl = (url: string): string => {
  if (!url) return "";

  // If URL is already absolute (starts with http:// or https://)
  if (url.match(/^https?:\/\//)) {
    return url;
  }

  // If URL is a data URL (base64 encoded)
  if (url.startsWith("data:")) {
    return url;
  }

  // If it's a relative URL starting with /api/
  if (url.startsWith("/api/")) {
    // Use the current origin for API calls
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}${url}`;
  }

  // If URL is relative, prepend the API base URL
  return `http://localhost:8081${url.startsWith("/") ? "" : "/"}${url}`;
};

/**
 * Validate avatar URL format and size for data URLs
 * @param url - The avatar URL to validate
 * @returns Validated URL or null if invalid
 */
export const validateAvatarUrl = (url: string): string | null => {
  if (!url) return null;

  // Get transformed URL first
  const transformedUrl = getAvatarUrl(url);
  if (!transformedUrl) return null;

  // Check if it's a data URL
  if (transformedUrl.startsWith("data:")) {
    // Check size limit (most browsers support up to 2MB for data URLs)
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (transformedUrl.length > maxSize) {
      console.warn(
        "[avatarHelper] Avatar too large:",
        transformedUrl.length,
        "bytes, max:",
        maxSize
      );
      return null; // Fallback to default icon
    }

    // Validate data URL format
    const dataUrlRegex =
      /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,/;
    if (!dataUrlRegex.test(transformedUrl)) {
      console.warn(
        "[avatarHelper] Invalid data URL format:",
        transformedUrl.substring(0, 100)
      );
      return null;
    }
  }

  return transformedUrl;
};
