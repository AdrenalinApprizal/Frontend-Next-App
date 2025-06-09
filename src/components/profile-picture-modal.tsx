"use client";

import { useState, useRef } from "react";
import { FaTimes, FaUser, FaUpload } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useAuth } from "@/hooks/auth/useAuth";
import { useUserInfoContext } from "@/components/auth/user-info-provider";

interface ProfilePictureModalProps {
  currentImageUrl?: string;
  onClose: () => void;
  onUploaded: (newPictureUrl: string) => void;
}

export function ProfilePictureModal({
  currentImageUrl,
  onClose,
  onUploaded,
}: ProfilePictureModalProps) {
  const auth = useAuth() as {
    updateAvatar: (fileOrBase64: File | string) => Promise<any>;
  };
  const updateAvatar = auth.updateAvatar;
  const { refetch } = useUserInfoContext();

  // State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Functions
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const onFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];

      // Validate file type and size
      if (!file.type.startsWith("image/")) {
        toast.error("Please select an image file");
        resetSelection();
        return;
      }

      // Limit file size to 5MB
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        resetSelection();
        return;
      }

      setSelectedFile(file);

      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const cancelSelection = () => {
    resetSelection();
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadImage = async () => {
    if (!selectedFile) return;

    try {
      setIsUploading(true);

      // Convert file to base64 string
      const reader = new FileReader();
      const filePromise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(selectedFile);
      });

      const base64String = await filePromise;
      console.log("File converted to base64, sending to API...");

      try {
        // Use the updateAvatar function from auth hook
        const response = await updateAvatar(base64String);

        if (response && response.profile_picture_url) {
          toast.success("Profile picture updated successfully");

          // Refresh user info data
          await refetch();

          // Notify parent component
          onUploaded(response.profile_picture_url);
          onClose();
        } else {
          throw new Error("Invalid server response");
        }
      } catch (err) {
        console.error("Failed to update avatar:", err);
        throw err;
      }
    } catch (error: any) {
      console.error("Profile picture upload error:", error);
      toast.error(error.message || "Failed to upload profile picture");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black bg-opacity-70 backdrop-blur-sm">
      <div className="bg-[#050C1B] border border-blue-500/30 p-4 rounded-lg shadow-lg max-w-md w-full text-white relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-200"
        >
          <FaTimes size={18} />
        </button>

        {/* Header */}
        <div className="text-center mb-4">
          <h3 className="text-lg font-bold">Change Profile Picture</h3>
        </div>

        {/* Content */}
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Preview Area */}
          <div
            className={`w-32 h-32 rounded-full overflow-hidden border-2 border-blue-500 flex items-center justify-center bg-blue-600/30 ${
              isUploading ? "animate-pulse" : ""
            }`}
          >
            {isUploading ? (
              <div className="h-full w-full flex items-center justify-center bg-black bg-opacity-60">
                <div className="animate-spin rounded-full h-12 w-12 border-2 border-t-transparent border-blue-400"></div>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt="Current Profile Picture"
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUser className="h-16 w-16 text-blue-400" />
            )}
          </div>

          {/* Upload Controls */}
          <div className="w-full">
            {!previewUrl && !isUploading && (
              <div className="text-center space-y-6">
                <p className="text-gray-300 text-sm">
                  Choose a new profile picture
                </p>
                <button
                  onClick={triggerFileInput}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded w-full flex items-center justify-center"
                >
                  <FaUpload className="mr-2" />
                  Select Image
                </button>
              </div>
            )}

            {previewUrl && !isUploading && (
              <div className="space-y-4 mt-4">
                <div className="text-sm text-gray-300 text-center">
                  <p>Selected image preview</p>
                </div>
                <div className="flex justify-between">
                  <button
                    onClick={cancelSelection}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded w-1/2 mr-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={uploadImage}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded w-1/2"
                  >
                    Upload Image
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileSelected}
          accept="image/*"
          className="hidden"
        />
      </div>
    </div>
  );
}
