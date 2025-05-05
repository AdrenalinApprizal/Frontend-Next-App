"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "react-hot-toast";
import {
  FaEnvelope,
  FaUser,
  FaUsers,
  FaSignOutAlt,
  FaUserCog,
} from "react-icons/fa";
import { ProfilePopup } from "./profile-popup";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isProfilePopupOpen, setIsProfilePopupOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      toast.loading("Logging out...");

      // Sign out and redirect to login page
      await signOut({ redirect: false });

      // Show success message and redirect
      toast.dismiss();
      toast.success("Successfully logged out");
      router.push("/");
    } catch (error) {
      console.error("Logout error:", error);
      toast.dismiss();
      toast.error("An error occurred during logout");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <nav className="flex flex-col justify-between h-screen w-16 bg-[#050C1B] text-white py-5">
        {/* Logo at the top */}
        <div className="flex flex-col items-center">
          <div className="flex items-center justify-center w-12 h-12 mb-10">
            <Image
              src="/images/voxtalogo.png"
              alt="Voxta Logo"
              className="rounded-full"
              width={40}
              height={40}
            />
          </div>

          {/* Navigation Icons */}
          <div className="flex flex-col space-y-8">
            <Link
              href="/chat/messages"
              className={`p-2 rounded-md ${
                pathname === "/chat/messages"
                  ? "bg-gray-700"
                  : "hover:bg-gray-800"
              }`}
            >
              <FaEnvelope className="h-6 w-6" />
            </Link>

            <Link
              href="/chat/friends"
              className={`p-2 rounded-md ${
                pathname === "/chat/friends"
                  ? "bg-gray-700"
                  : "hover:bg-gray-800"
              }`}
            >
              <FaUser className="h-6 w-6" />
            </Link>

            <Link
              href="/chat/groups"
              className={`p-2 rounded-md ${
                pathname === "/chat/groups"
                  ? "bg-gray-700"
                  : "hover:bg-gray-800"
              }`}
            >
              <FaUsers className="h-6 w-6" />
            </Link>
          </div>
        </div>

        {/* Bottom buttons section */}
        <div className="flex flex-col items-center space-y-4">
          {/* Profile button */}
          <button
            onClick={() => setIsProfilePopupOpen(true)}
            className={`p-2 rounded-md hover:bg-gray-800`}
          >
            <FaUserCog className="h-6 w-6" />
          </button>

          {/* Sign Out Button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`p-2 rounded-md hover:bg-gray-800 ${
              isLoggingOut ? "opacity-50 cursor-not-allowed" : ""
            }`}
            title="Sign out"
          >
            <FaSignOutAlt className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* Profile Popup */}
      {isProfilePopupOpen && (
        <ProfilePopup onClose={() => setIsProfilePopupOpen(false)} />
      )}
    </>
  );
}
