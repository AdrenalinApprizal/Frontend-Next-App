"use client";

import { useState } from "react";
import {
  FaUser,
  FaFile,
  FaImage,
  FaTimes,
  FaLink,
  FaEnvelope,
  FaPhone,
  FaCalendarAlt,
  FaMapMarkerAlt,
  FaUserPlus,
} from "react-icons/fa";

interface FriendDetails {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinDate: string;
  location: string;
  status: "online" | "offline";
  avatar?: string;
}

interface UserProfileInfoProps {
  username?: string; // Tetap mendukung prop lama
  friendDetails?: FriendDetails; // Tambahkan prop baru
  onClose?: () => void;
}

export default function UserProfileInfo({
  username,
  friendDetails,
  onClose,
}: UserProfileInfoProps) {
  // Menggunakan data dari friendDetails jika tersedia, atau fallback ke username
  const displayName = friendDetails?.name || username || "User";

  // Data contoh untuk media, link, dan file
  const mediaItems = [
    { id: 1, url: "/images/voxtalogo.png", type: "image" },
    { id: 2, url: "/images/voxtalogo.png", type: "image" },
    { id: 3, url: "/images/voxtalogo.png", type: "image" },
    { id: 4, url: "/images/voxtalogo.png", type: "image" },
    { id: 5, url: "/images/voxtalogo.png", type: "image" },
    { id: 6, url: "/images/voxtalogo.png", type: "image" },
    { id: 7, url: "/images/voxtalogo.png", type: "image" },
  ];

  const linkItems = [
    {
      id: 1,
      url: "https://bit.ly/3xYzA1B_example_long_random_generated_link_for_testing_purposes",
      preview: "/images/voxtalogo.png",
    },
    {
      id: 2,
      url: "https://example.com/another-example-link",
      preview: "/images/voxtalogo.png",
    },
  ];

  const fileItems = [
    {
      id: 1,
      name: "Project_Proposal.pdf",
      size: "1.2 MB",
      date: "12 Apr 2025",
    },
    { id: 2, name: "Meeting_Notes.docx", size: "604 KB", date: "2 Mar 2025" },
    { id: 3, name: "Budget_2025.xlsx", size: "845 KB", date: "15 Feb 2025" },
  ];

  return (
    <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        {onClose && (
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <FaTimes size={20} />
            </button>
          </div>
        )}

        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 mb-3 flex items-center justify-center">
            {friendDetails?.avatar ? (
              <img
                src={friendDetails.avatar}
                alt={friendDetails.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUser className="h-12 w-12 text-gray-400" />
            )}
          </div>
          <h2 className="text-xl font-semibold">{displayName}</h2>
          <p className="text-gray-500 text-sm">
            {friendDetails?.status === "online" ? "Online" : "Offline"} • Last
            seen today at 2:45 PM
          </p>
        </div>
      </div>

      {/* Media Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">
            Media{" "}
            <span className="text-gray-500 text-sm">({mediaItems.length})</span>
          </h3>
          <a href="#" className="text-sm text-blue-500">
            View All
          </a>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {mediaItems.slice(0, 3).map((item) => (
            <div
              key={item.id}
              className="aspect-square bg-gray-200 rounded-md overflow-hidden"
            >
              <img
                src={item.url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}
          <div className="aspect-square bg-gray-200 rounded-md overflow-hidden relative">
            <img
              src={mediaItems[3].url}
              alt=""
              className="w-full h-full object-cover opacity-60"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 text-white font-semibold">
              {mediaItems.length - 3}+
            </div>
          </div>
        </div>
      </div>

      {/* Links Section */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">
            Link{" "}
            <span className="text-gray-500 text-sm">({linkItems.length})</span>
          </h3>
          <a href="#" className="text-sm text-blue-500">
            View All
          </a>
        </div>
        {linkItems.map((item) => (
          <div
            key={item.id}
            className="bg-gray-100 rounded-md p-3 flex items-start mb-2"
          >
            <div className="w-16 h-16 bg-gray-300 rounded-md overflow-hidden mr-3 flex-shrink-0">
              <img
                src={item.preview}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <a
                href={item.url}
                className="text-blue-500 text-sm line-clamp-2 mb-2 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.url}
              </a>
              <button className="text-gray-600 text-sm hover:text-gray-800">
                View Message
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Files Section */}
      <div className="p-4">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-medium">
            File{" "}
            <span className="text-gray-500 text-sm">({fileItems.length})</span>
          </h3>
          <a href="#" className="text-sm text-blue-500">
            View All
          </a>
        </div>
        {fileItems.map((item) => (
          <div
            key={item.id}
            className="flex items-center py-3 border-b border-gray-100 last:border-0"
          >
            <div className="w-10 h-10 bg-gray-200 rounded mr-3 flex-shrink-0 flex items-center justify-center">
              <FaFile className="text-gray-500" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{item.name}</p>
              <div className="flex text-xs text-gray-500">
                <span>{item.size}</span>
                <span className="mx-2">•</span>
                <span>{item.date}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
