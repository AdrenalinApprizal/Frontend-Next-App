"use client";

import { useState, useEffect } from "react";
import { FaTimes, FaUser, FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-hot-toast";
import { useAuth } from "@/hooks/auth/useAuth";
import { useUserInfoContext } from "@/components/auth/user-info-provider";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface ProfilePopupProps {
  onClose: () => void;
}

export function ProfilePopup({ onClose }: ProfilePopupProps) {
  const router = useRouter();
  const { updateProfile, changePassword, getUserInfo } = useAuth();
  const { userInfo, isLoading, isError, refetch } = useUserInfoContext();
  const { data: session } = useSession();

  // Helper function to handle avatar URLs correctly
  const getAvatarUrl = (url: string): string => {
    console.log("Original avatar URL:", url);

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
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      return `${origin}${url}`;
    }

    // If URL is relative, prepend the API base URL
    // Adjust this URL according to where your images are actually stored
    return `http://localhost:8081${url.startsWith("/") ? "" : "/"}${url}`;
  };

  // UI state
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Password visibility toggles
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Profile form states
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone_number: "",
    about_me: "",
  });

  // Password form states
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  // Computed property for password mismatch
  const passwordMismatch =
    passwordData.new_password !== passwordData.confirm_password &&
    passwordData.confirm_password !== "";

  // Initialize form data when user info is loaded
  useEffect(() => {
    if (userInfo) {
      setFormData({
        first_name: userInfo.first_name || "",
        last_name: userInfo.last_name || "",
        phone_number: userInfo.phone_number || "",
        about_me: userInfo.about_me || "",
      });
    }
  }, [userInfo]);

  // Function to set editing mode
  const setEditing = (value: boolean) => {
    setIsEditing(value);

    if (value && userInfo) {
      setFormData({
        first_name: userInfo.first_name || "",
        last_name: userInfo.last_name || "",
        phone_number: userInfo.phone_number || "",
        about_me: userInfo.about_me || "",
      });
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!session?.access_token) {
        throw new Error("No authentication token available");
      }

      // Use the updateProfile function from auth hook
      await updateProfile(formData);

      // Refresh user data
      await refetch();

      toast.success("Profile updated successfully");
      setIsEditing(false);
    } catch (error: any) {
      console.error("Profile update error:", error);
      toast.error(
        error.message || "An error occurred while updating your profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the changePassword function from auth hook
      await changePassword({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
      });

      toast.success("Password changed successfully");

      // Reset form and go back to profile tab
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
      setActiveTab("profile");
    } catch (error: any) {
      console.error("Password update error:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#050C1B] rounded-lg shadow-lg max-w-md w-full p-5 relative">
          <div className="flex justify-center items-center mb-4">
            <h2 className="text-lg font-bold text-white">My Profile</h2>
          </div>
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#050C1B] rounded-lg shadow-lg max-w-md w-full p-5 relative">
          <div className="flex justify-center items-center mb-4">
            <h2 className="text-lg font-bold text-white">My Profile</h2>
          </div>
          <div className="text-center p-4">
            <p className="text-red-500">
              Something went wrong. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#050C1B] rounded-lg shadow-lg w-full max-w-sm p-4 relative">
        {activeTab === "profile" && !isEditing && userInfo && (
          <>
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold text-white">My Profile</h2>
            </div>

            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-600/30 relative flex items-center justify-center">
                  {userInfo.profile_picture_url ? (
                    <img
                      src={getAvatarUrl(userInfo.profile_picture_url)}
                      alt={userInfo.username || "Profile"}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.log(
                          "Image failed to load:",
                          userInfo.profile_picture_url
                        );
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = ""; // Clear the src
                        e.currentTarget.style.display = "none"; // Hide the img
                        // Check if parent exists before trying to add a class
                        if (e.currentTarget.parentElement) {
                          e.currentTarget.parentElement.classList.add(
                            "avatar-fallback"
                          );
                        }
                      }}
                    />
                  ) : (
                    <FaUser className="h-8 w-8 text-blue-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 px-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm text-gray-300 block">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={userInfo.first_name || ""}
                    readOnly
                    className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                    placeholder="First Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-300 block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={userInfo.last_name || ""}
                    readOnly
                    className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">Username</label>
                <input
                  type="text"
                  value={userInfo.username || ""}
                  readOnly
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                  placeholder="Username"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">Email</label>
                <input
                  type="email"
                  value={userInfo.email || ""}
                  readOnly
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                  placeholder="Email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={userInfo.phone_number || ""}
                  readOnly
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                  placeholder="Phone Number"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">About Me</label>
                <textarea
                  value={userInfo.about_me || ""}
                  readOnly
                  rows={2}
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 min-h-[60px] resize-none text-sm"
                  placeholder="Write something about yourself..."
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded h-9 w-full text-sm"
                >
                  Edit Profile
                </button>
              </div>

              <div className="flex justify-center pt-1">
                <button
                  onClick={() => setActiveTab("password")}
                  className="text-blue-400 text-sm hover:text-blue-300 hover:underline"
                >
                  Change Password
                </button>
              </div>
            </div>
          </>
        )}

        {userInfo && activeTab === "profile" && isEditing && (
          <form onSubmit={handleProfileUpdate} className="space-y-3">
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold text-white">Edit Profile</h2>
            </div>

            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="h-16 w-16 rounded-full overflow-hidden bg-blue-600/30 relative cursor-pointer">
                  {userInfo.profile_picture_url ? (
                    <img
                      src={getAvatarUrl(userInfo.profile_picture_url)}
                      alt={userInfo.username}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.log(
                          "Image failed to load:",
                          userInfo.profile_picture_url
                        );
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = ""; // Clear the src
                        e.currentTarget.style.display = "none"; // Hide the img
                        // Check if parent exists before trying to add a class
                        if (e.currentTarget.parentElement) {
                          e.currentTarget.parentElement.classList.add(
                            "avatar-fallback"
                          );
                        }
                      }}
                    />
                  ) : (
                    <FaUser className="h-8 w-8 text-blue-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3 px-1">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-sm text-gray-300 block">
                    First Name
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                    placeholder="First Name"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-gray-300 block">
                    Last Name
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    value={formData.last_name}
                    onChange={handleInputChange}
                    className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                    placeholder="Last Name"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">Username</label>
                <input
                  type="text"
                  value={userInfo.username || ""}
                  readOnly
                  className="w-full bg-[#0b1529]/70 text-gray-400 rounded border border-gray-700 p-2 h-9 text-sm"
                  placeholder="Username"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">Email</label>
                <input
                  type="email"
                  value={userInfo.email || ""}
                  readOnly
                  className="w-full bg-[#0b1529]/70 text-gray-400 rounded border border-gray-700 p-2 h-9 text-sm"
                  placeholder="Email"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                  placeholder="Phone Number"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm text-gray-300 block">About Me</label>
                <textarea
                  name="about_me"
                  value={formData.about_me}
                  onChange={handleInputChange}
                  rows={2}
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 min-h-[60px] resize-none text-sm"
                  placeholder="Write something about yourself..."
                />
              </div>

              <div className="flex justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="border border-gray-700 text-gray-300 bg-[#0b1529] hover:bg-[#0b1529]/90 font-medium py-1.5 px-4 rounded h-9 text-sm"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded h-9 text-sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        )}

        {userInfo && activeTab === "password" && (
          <form onSubmit={handlePasswordUpdate} className="space-y-3">
            <div className="text-center mb-3">
              <h2 className="text-lg font-bold text-white">Change Password</h2>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-300 block">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  id="current_password"
                  name="current_password"
                  value={passwordData.current_password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showCurrentPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-300 block">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  id="new_password"
                  name="new_password"
                  value={passwordData.new_password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showNewPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-300 block">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  id="confirm_password"
                  name="confirm_password"
                  value={passwordData.confirm_password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full bg-[#0b1529] text-white rounded border border-gray-700 p-2 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showConfirmPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {passwordMismatch && (
                <p className="text-red-500 text-xs mt-1">
                  Passwords do not match
                </p>
              )}
            </div>

            <div className="flex justify-between pt-3">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="border border-gray-700 text-gray-300 bg-[#0b1529] hover:bg-[#0b1529]/90 font-medium py-1.5 px-4 rounded h-9 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded h-9 text-sm"
                disabled={
                  isSubmitting ||
                  passwordData.new_password !== passwordData.confirm_password
                }
              >
                {isSubmitting ? "Changing..." : "Change Password"}
              </button>
            </div>
          </form>
        )}

        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
        >
          <FaTimes size={18} />
        </button>
      </div>
    </div>
  );
}
