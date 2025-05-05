"use client";

import { useState, useRef, useEffect } from "react";
import { FaTimes, FaEdit, FaCamera, FaKey } from "react-icons/fa";
import { useUserInfoContext } from "@/components/auth/user-info-provider";
import { toast } from "react-hot-toast";
import { api } from "@/utils/api";
import { getSession, useSession } from "next-auth/react";

interface ProfilePopupProps {
  onClose: () => void;
}

export function ProfilePopup({ onClose }: ProfilePopupProps) {
  const { userInfo, isLoading, isError, refetch } = useUserInfoContext();
  const [activeTab, setActiveTab] = useState<"profile" | "password">("profile");
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load profile information");
    }
  }, [isError]);

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
      const response = await api.put("users/profile", formData);

      toast.success("Profile updated successfully");
      refetch(); // Refresh user data
      setIsEditing(false);
    } catch (error) {
      console.error("Profile update error:", error);
      toast.error("An error occurred while updating your profile");
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
      await api.put("auth/users/password", passwordData);

      toast.success("Password changed successfully");
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (error) {
      console.error("Password update error:", error);
      toast.error("An error occurred while changing your password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsSubmitting(true);
      toast.loading("Uploading image...");

      // Create FormData instance to handle file upload
      const formData = new FormData();
      formData.append("profile_picture", file);

      // Send the file to the backend using fetch directly since FormData needs special handling
      const session = await getSession();
      const response = await fetch(
        "http://localhost:8081/api/users/profile/avatar",
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      toast.dismiss();

      if (response.ok) {
        toast.success("Profile picture updated");
        refetch(); // Refresh user data
      } else {
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData?.message || "Failed to update profile picture");
      }
    } catch (error) {
      console.error("Avatar update error:", error);
      toast.dismiss();
      toast.error("An error occurred while updating your profile picture");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-[#101827] rounded-lg shadow-lg max-w-md w-full p-4 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Your Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <FaTimes />
            </button>
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
        <div className="bg-[#101827] rounded-lg shadow-lg max-w-md w-full p-4 relative">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-white">Your Profile</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <FaTimes />
            </button>
          </div>
          <div className="text-center p-4">
            <p className="text-red-400">
              Something went wrong. Please try again later.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#050C1B] rounded-lg shadow-lg max-w-md w-full p-6 relative">
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-white hover:text-gray-300"
        >
          <FaTimes size={24} />
        </button>

        {activeTab === "profile" && !isEditing && userInfo && (
          <div className="space-y-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-2">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-blue-600/30">
                  <img
                    src={userInfo.profile_picture_url || "https://via.placeholder.com/150"}
                    alt={userInfo.username}
                    className="h-full w-full object-cover"
                  />
                </div>
                <h2 className="text-xl font-semibold text-white mt-2">
                  {userInfo.first_name} {userInfo.last_name}
                </h2>
                <div className="flex justify-center space-x-2 mt-2">
                  <button
                    onClick={handleAvatarClick}
                    className="bg-[#101827] text-white text-sm py-1 px-3 rounded-md"
                  >
                    Change Picture
                  </button>
                  <button
                    className="bg-[#101827] text-white text-sm py-1 px-3 rounded-md"
                  >
                    Delete Picture
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white">First Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userInfo.first_name || ""}
                    readOnly
                    className="w-full bg-[#1A2132] text-white rounded p-3 pr-10 border border-gray-600"
                    placeholder="Placeholder"
                  />
                  <FaEdit className="absolute right-3 top-3 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="text-white">Last Name</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userInfo.last_name || ""}
                    readOnly
                    className="w-full bg-[#1A2132] text-white rounded p-3 pr-10 border border-gray-600"
                    placeholder="Placeholder"
                  />
                  <FaEdit className="absolute right-3 top-3 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="text-white">Email</label>
                <div className="relative">
                  <input
                    type="email"
                    value={userInfo.email || ""}
                    readOnly
                    className="w-full bg-[#1A2132] text-white rounded p-3 pr-10 border border-gray-600"
                    placeholder="Placeholder"
                  />
                  <FaEdit className="absolute right-3 top-3 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="text-white">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={userInfo.phone_number || ""}
                    readOnly
                    className="w-full bg-[#1A2132] text-white rounded p-3 pr-10 border border-gray-600"
                    placeholder="Placeholder"
                  />
                  <FaEdit className="absolute right-3 top-3 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="text-white">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={userInfo.username || ""}
                    readOnly
                    className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
                    placeholder="Placeholder"
                  />
                </div>
              </div>
              
              <div className="flex justify-center mt-2">
                <button
                  onClick={() => setActiveTab("password")}
                  className="bg-[#1A2132] text-white py-2 px-5 rounded-md"
                >
                  Change Password
                </button>
              </div>
              
              <div>
                <label className="text-white">About Me</label>
                <textarea
                  value={userInfo.about_me || ""}
                  readOnly
                  rows={4}
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
                />
              </div>
              
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => setIsEditing(true)}
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {userInfo && activeTab === "profile" && isEditing && (
          <form onSubmit={handleProfileUpdate} className="space-y-4">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="relative mb-2">
                <div 
                  className="h-20 w-20 rounded-full overflow-hidden bg-blue-600/30 relative cursor-pointer"
                  onClick={handleAvatarClick}
                >
                  <img
                    src={userInfo.profile_picture_url || "https://via.placeholder.com/150"}
                    alt={userInfo.username}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <FaCamera size={20} className="text-white" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-white mt-2">
                  {userInfo.first_name} {userInfo.last_name}
                </h2>
                <div className="flex justify-center space-x-2 mt-2">
                  <button
                    type="button"
                    onClick={handleAvatarClick}
                    className="bg-[#101827] text-white text-sm py-1 px-3 rounded-md"
                  >
                    Change Picture
                  </button>
                  <button
                    type="button"
                    className="bg-[#101827] text-white text-sm py-1 px-3 rounded-md"
                  >
                    Delete Picture
                  </button>
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-white">First Name</label>
                <input
                  type="text"
                  name="first_name"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
                  placeholder="Placeholder"
                />
              </div>
              
              <div>
                <label className="text-white">Last Name</label>
                <input
                  type="text"
                  name="last_name"
                  value={formData.last_name}
                  onChange={handleInputChange}
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
                  placeholder="Placeholder"
                />
              </div>
              
              <div>
                <label className="text-white">Email</label>
                <input
                  type="email"
                  value={userInfo.email || ""}
                  readOnly
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600 opacity-75"
                  placeholder="Placeholder"
                />
              </div>
              
              <div>
                <label className="text-white">Phone Number</label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
                  placeholder="Placeholder"
                />
              </div>
              
              <div>
                <label className="text-white">Username</label>
                <input
                  type="text"
                  value={userInfo.username || ""}
                  readOnly
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600 opacity-75"
                  placeholder="Placeholder"
                />
              </div>
              
              <div>
                <label className="text-white">About Me</label>
                <textarea
                  name="about_me"
                  value={formData.about_me}
                  onChange={handleInputChange}
                  rows={4}
                  className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
                />
              </div>
              
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        )}

        {userInfo && activeTab === "password" && (
          <form onSubmit={handlePasswordUpdate} className="space-y-4">
            <h2 className="text-xl font-semibold text-white mb-6 text-center">Change Password</h2>
            
            <div>
              <label className="text-white">Current Password</label>
              <input
                type="password"
                id="current_password"
                name="current_password"
                value={passwordData.current_password}
                onChange={handlePasswordChange}
                required
                className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
              />
            </div>

            <div>
              <label className="text-white">New Password</label>
              <input
                type="password"
                id="new_password"
                name="new_password"
                value={passwordData.new_password}
                onChange={handlePasswordChange}
                required
                className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
              />
            </div>

            <div>
              <label className="text-white">Confirm New Password</label>
              <input
                type="password"
                id="confirm_password"
                name="confirm_password"
                value={passwordData.confirm_password}
                onChange={handlePasswordChange}
                required
                className="w-full bg-[#1A2132] text-white rounded p-3 border border-gray-600"
              />
              {passwordData.new_password !== passwordData.confirm_password &&
                passwordData.confirm_password && (
                  <p className="text-red-400 text-xs mt-1">
                    Passwords do not match
                  </p>
                )}
            </div>

            <div className="flex justify-between mt-6">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md"
              >
                Back to Profile
              </button>
              <button
                type="submit"
                className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md disabled:opacity-50"
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
      </div>
    </div>
  );
}
