"use client";

import React, { useState, useCallback, useMemo } from "react";
import { FaUser } from "react-icons/fa";

interface OptimizedAvatarProps {
  src?: string | null;
  alt: string;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallbackIcon?: React.ReactNode;
}

export function OptimizedAvatar({
  src,
  alt,
  className,
  size = "md",
  fallbackIcon,
}: OptimizedAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(!!src);

  // Size mappings
  const sizeClasses = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
    xl: "h-16 w-16",
  };

  const iconSizes = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-8 w-8",
  };

  // Validate and optimize image URL
  const optimizedSrc = useMemo(() => {
    ({
      hasSrc: !!src,
      srcType: typeof src,
      srcLength: src?.length || 0,
      srcPreview: src?.substring?.(0, 50) || "no src",
      isDataUrl: src?.startsWith?.("data:") || false,
    });

    if (!src) {
      return null;
    }

    // Check if it's a data URL
    if (src.startsWith("data:")) {
      // Validate data URL format
      const dataUrlRegex =
        /^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml);base64,/;
      if (!dataUrlRegex.test(src)) {
        console.warn(
          "[OptimizedAvatar] Invalid data URL format:",
          src.substring(0, 100)
        );
        return null;
      }

      // Check size limit (2MB for safety across browsers)
      const maxSize = 2 * 1024 * 1024;
      if (src.length > maxSize) {
        console.warn(
          "[OptimizedAvatar] Avatar too large:",
          src.length,
          "bytes, max:",
          maxSize
        );

        // Try to compress or return null
        try {
          // For very large images, we could implement client-side compression here
          // For now, we'll just reject them
          return null;
        } catch (error) {
          console.error(
            "[OptimizedAvatar] Error processing large image:",
            error
          );
          return null;
        }
      }

      // Check if base64 data appears to be corrupted (very short or has invalid characters)
      const base64Data = src.split(",")[1];
      if (!base64Data || base64Data.length < 100) {
        console.warn(
          "[OptimizedAvatar] Base64 data too short or missing, length:",
          base64Data?.length || 0
        );
        return null;
      }

      // Test if base64 is valid
      try {
        atob(base64Data.substring(0, 100)); // Test decode a small portion
      } catch (error) {
        console.warn("[OptimizedAvatar] Invalid base64 data:", error);
        return null;
      }

      return src;
    }

    return src;
  }, [src]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, [alt]);

  const handleError = useCallback(() => {
    console.error("[OptimizedAvatar] ❌ Image failed to load for:", alt, {
      src: optimizedSrc?.substring?.(0, 100),
      srcLength: optimizedSrc?.length,
    });
    setIsLoading(false);
    setHasError(true);
  }, [alt, optimizedSrc]);

  const showFallback = !optimizedSrc || hasError;

  return (
    <div
      className={`${
        sizeClasses[size]
      } rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center ${
        className || ""
      }`}
    >
      {showFallback ? (
        fallbackIcon || (
          <FaUser className={`${iconSizes[size]} text-gray-500`} />
        )
      ) : (
        <div className="relative h-full w-full">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            </div>
          )}
          <img
            src={optimizedSrc}
            alt={alt}
            className="h-full w-full object-cover"
            onLoad={handleLoad}
            onError={handleError}
            loading="lazy" // Enable lazy loading for performance
            decoding="async" // Enable async decoding
            style={{
              // Optimize rendering performance
              imageRendering: "auto",
              // Hide until loaded to prevent layout shift
              opacity: isLoading ? 0 : 1,
              transition: "opacity 0.2s ease-in-out",
            }}
          />
        </div>
      )}
    </div>
  );
}
