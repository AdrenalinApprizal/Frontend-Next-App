"use client";

import { useState, useRef, useEffect } from "react";
import {
  FaUsers,
  FaEnvelope,
  FaPaperPlane,
  FaUser,
  FaCog,
  FaSignOutAlt,
  FaInfo,
  FaComment,
  FaEllipsisV,
  FaCheck,
  FaCheckDouble,
  FaTimes,
  FaFile,
  FaImage,
  FaUserPlus,
  FaLink,
  FaSearch,
  FaFilter,
} from "react-icons/fa";
import { Paperclip, X, Edit2, Trash, Info, Search, Filter } from "lucide-react";
import Link from "next/link";
import SearchFilterPopup from "./search-on-group";
import GroupProfileInfo from "./group-profile-info";

interface GroupDetailProps {
  groupId: string;
  groupName: string;
}

interface GroupMember {
  id: string;
  name: string;
  status: "online" | "offline";
  role: "admin" | "member";
  avatar?: string;
  isBlocked?: boolean;
}

interface GroupDetails {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  memberCount: number;
  members: GroupMember[];
  avatar?: string;
}

interface GroupMessage {
  id: string;
  content: string;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  };
  timestamp: string;
  isCurrentUser: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  attachment?: {
    type: "image" | "file";
    url: string;
    name: string;
    size?: string;
  };
}

export function GroupDetail({ groupId, groupName }: GroupDetailProps) {
  const [inputMessage, setInputMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

  // Search related states
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<GroupMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // For demo purposes, we'll use static data here
  // In a real application, this would be fetched from an API
  const [groupDetails, setGroupDetails] = useState<GroupDetails>(() => {
    // Initialize with static data based on groupId
    return {
      id: groupId,
      name: groupName,
      description: "This is a group for team collaboration and discussions.",
      createdAt: "January 10, 2025",
      memberCount: 8,
      members: [
        {
          id: "1",
          name: "John Doe",
          status: "online",
          role: "admin",
          avatar: undefined,
        },
        {
          id: "2",
          name: "Jane Smith",
          status: "offline",
          role: "member",
          avatar: undefined,
          isBlocked: true,
        },
        {
          id: "3",
          name: "Alex Johnson",
          status: "online",
          role: "member",
          avatar: undefined,
        },
        {
          id: "4",
          name: "Sam Wilson",
          status: "offline",
          role: "member",
          avatar: undefined,
        },
        {
          id: "5",
          name: "Maria Garcia",
          status: "online",
          role: "member",
          avatar: undefined,
        },
      ],
      avatar: undefined,
    };
  });

  const [messages, setMessages] = useState<GroupMessage[]>([
    {
      id: "1",
      content: "Hello everyone! Welcome to the group.",
      sender: { id: "1", name: "John Doe", avatar: undefined },
      timestamp: "10:20 AM",
      isCurrentUser: false,
    },
    {
      id: "2",
      content: "Thanks for adding me!",
      sender: { id: "2", name: "Jane Smith", avatar: undefined },
      timestamp: "10:22 AM",
      isCurrentUser: false,
    },
    {
      id: "3",
      content: "Let's discuss the upcoming project deadline.",
      sender: { id: "1", name: "John Doe", avatar: undefined },
      timestamp: "10:25 AM",
      isCurrentUser: false,
    },
    {
      id: "4",
      content: "I'll share the documents shortly.",
      sender: { id: "user", name: "You", avatar: undefined },
      timestamp: "10:30 AM",
      isCurrentUser: true,
    },
  ]);

  // Add useEffect to scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Format file size to readable format (KB, MB)
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  // Handle file upload
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, you would upload to server and get URL
      const newMessage: GroupMessage = {
        id: `${messages.length + 1}`,
        content: "",
        sender: { id: "user", name: "You", avatar: undefined },
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        isCurrentUser: true,
        attachment: {
          type: "file",
          url: "#",
          name: file.name,
          size: formatFileSize(file.size),
        },
      };
      setMessages([...messages, newMessage]);
      setIsAttachmentMenuOpen(false);
    }
  };

  // Handle image upload
  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // In a real app, you would upload to server and get URL
      const newMessage: GroupMessage = {
        id: `${messages.length + 1}`,
        content: "",
        sender: { id: "user", name: "You", avatar: undefined },
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        isCurrentUser: true,
        attachment: {
          type: "image",
          url: URL.createObjectURL(file),
          name: file.name,
          size: formatFileSize(file.size),
        },
      };
      setMessages([...messages, newMessage]);
      setIsAttachmentMenuOpen(false);
    }
  };

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      if (editingMessageId) {
        // Edit existing message
        setMessages(
          messages.map((message) =>
            message.id === editingMessageId
              ? { ...message, content: inputMessage, isEdited: true }
              : message
          )
        );
        setEditingMessageId(null);
      } else {
        // Send new message
        const newMessage: GroupMessage = {
          id: `${messages.length + 1}`,
          content: inputMessage,
          sender: { id: "user", name: "You", avatar: undefined },
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }),
          isCurrentUser: true,
        };
        setMessages([...messages, newMessage]);
      }
      setInputMessage("");
    }
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message) {
      setInputMessage(message.content);
      setEditingMessageId(messageId);
      setShowDropdown(null);
    }
  };

  const handleUnsendMessage = (messageId: string) => {
    setMessages(
      messages.map((message) =>
        message.id === messageId
          ? {
              ...message,
              content: "This message has been unsent",
              isDeleted: true,
            }
          : message
      )
    );
    setShowDropdown(null);
  };

  const toggleDropdown = (messageId: string) => {
    setShowDropdown((prevId) => (prevId === messageId ? null : messageId));
  };

  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setInputMessage("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle search functionality
  const handleSearch = (query: string, members: string[]) => {
    setSearchQuery(query);
    setSelectedMembers(members);
    setIsSearching(true);

    // Filter messages based on search query and selected members
    const filtered = messages.filter(
      (message) =>
        message.content.toLowerCase().includes(query.toLowerCase()) &&
        (members.length === 0 || members.includes(message.sender.id))
    );

    setFilteredMessages(filtered);
  };

  // Filter out messages from blocked members
  const visibleMessages = (isSearching ? filteredMessages : messages).filter(
    (message) => {
      if (message.isCurrentUser) return true; // Always show user's own messages

      // Check if sender is blocked
      const senderMember = groupDetails.members.find(
        (member) => member.id === message.sender.id
      );
      return !senderMember?.isBlocked;
    }
  );

  const handleAttachmentClick = () => {
    setIsAttachmentMenuOpen(!isAttachmentMenuOpen);
  };

  const handleFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleImageUpload = () => {
    if (imageInputRef.current) {
      imageInputRef.current.click();
    }
  };

  return (
    <div className="h-full flex bg-gray-50">
      <div className="flex-1 flex flex-col">
        {/* Group Header */}
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 mr-3 flex-shrink-0 flex items-center justify-center">
              {groupDetails.avatar ? (
                <img
                  src={groupDetails.avatar}
                  alt={groupDetails.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <FaUsers className="h-6 w-6 text-gray-500" />
              )}
            </div>
            <div>
              <h2 className="font-semibold">{groupDetails.name}</h2>
              <p className="text-xs text-gray-500">
                {groupDetails.memberCount} members
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
              title="Search messages"
            >
              <FaSearch size={18} />
            </button>
            <div className="relative">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200"
                title="Group options"
              >
                <FaEllipsisV size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Chat messages */}
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {visibleMessages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.isCurrentUser ? "justify-end" : "justify-start"
              } mb-4`}
            >
              {!message.isCurrentUser && (
                <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex-shrink-0 flex items-center justify-center">
                  {message.sender.avatar ? (
                    <img
                      src={message.sender.avatar}
                      alt={message.sender.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FaUser className="h-4 w-4 text-gray-500" />
                  )}
                </div>
              )}
              <div className="flex flex-col max-w-[70%]">
                {/* Sender name display */}
                {!message.isCurrentUser && (
                  <span className="text-xs text-gray-500 mb-1 ml-1">
                    {message.sender.name}
                  </span>
                )}
                {message.isCurrentUser && (
                  <span className="text-xs text-gray-500 mb-1 self-end mr-1">
                    You
                  </span>
                )}
                <div
                  className={`rounded-lg px-4 py-2 ${
                    message.isCurrentUser
                      ? message.isDeleted
                        ? "bg-gray-200 text-gray-500 italic"
                        : "bg-blue-500 text-white"
                      : "bg-white border border-gray-200"
                  } min-w-[80px]`}
                >
                  <p className="break-words whitespace-pre-wrap">
                    {message.content}
                  </p>
                  {message.attachment && (
                    <div className="mt-2">
                      {message.attachment.type === "image" ? (
                        <img
                          src={message.attachment.url}
                          alt={message.attachment.name}
                          className="max-w-full rounded"
                        />
                      ) : (
                        <a
                          href={message.attachment.url}
                          download={message.attachment.name}
                          className="text-blue-500 hover:underline"
                        >
                          {message.attachment.name} ({message.attachment.size})
                        </a>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-end space-x-1 mt-1">
                    {message.isEdited && !message.isDeleted && (
                      <span
                        className={`text-xs ${
                          message.isCurrentUser
                            ? "text-blue-100"
                            : "text-gray-500"
                        }`}
                      >
                        (edited)
                      </span>
                    )}
                    <span
                      className={`text-xs ${
                        message.isCurrentUser
                          ? "text-blue-100"
                          : "text-gray-500"
                      }`}
                    >
                      {message.timestamp}
                    </span>
                  </div>

                  {/* Message actions dropdown (only for user messages) */}
                  {message.isCurrentUser && !message.isDeleted && (
                    <div className="relative">
                      <button
                        onClick={() => toggleDropdown(message.id)}
                        className="absolute top-0 right-0 -mt-1 -mr-8 p-1 rounded-full hover:bg-gray-200"
                        aria-label="Message options"
                      >
                        <FaEllipsisV className="h-3 w-3 text-gray-500" />
                      </button>

                      {showDropdown === message.id && (
                        <div
                          ref={dropdownRef}
                          className="absolute right-0 mt-1 mr-8 bg-white rounded-md shadow-lg z-10 w-36 py-1"
                        >
                          <button
                            onClick={() => handleEditMessage(message.id)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Edit2 className="h-4 w-4 mr-2" /> Edit
                          </button>
                          <button
                            onClick={() => handleUnsendMessage(message.id)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 flex items-center"
                          >
                            <Trash className="h-4 w-4 mr-2" /> Unsend
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input message */}
        <div className="p-4 bg-white border-t border-gray-200">
          {editingMessageId && (
            <div className="flex items-center mb-2 bg-blue-50 p-2 rounded">
              <span className="text-sm text-blue-700 flex-1">
                Editing message
              </span>
              <button
                onClick={handleCancelEdit}
                className="text-gray-600 hover:text-gray-800"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <div className="flex items-center">
            <button
              onClick={handleAttachmentClick}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
              title="Attach file"
            >
              <Paperclip size={20} />
            </button>
            {isAttachmentMenuOpen && (
              <div className="absolute bottom-full mb-2 left-4 bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                <button
                  onClick={handleFileUpload}
                  className="flex items-center text-gray-700 hover:text-blue-500 mb-2 w-full text-left px-4 py-2"
                >
                  <FaFile className="mr-2" /> File
                </button>
                <button
                  onClick={handleImageUpload}
                  className="flex items-center text-gray-700 hover:text-blue-500 w-full text-left px-4 py-2"
                >
                  <FaImage className="mr-2" /> Image
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              style={{ display: "none" }}
              onChange={handleImageChange}
            />
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                editingMessageId
                  ? "Edit your message..."
                  : "Type your message..."
              }
              className="flex-1 py-2 px-4 rounded-full border border-gray-300 focus:outline-none focus:border-blue-400"
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-500 text-white p-3 rounded-full ml-2 hover:bg-blue-600 focus:outline-none"
            >
              <FaPaperPlane size={16} />
            </button>
          </div>
        </div>
      </div>

      {showProfile && (
        <GroupProfileInfo
          groupName={groupName}
          groupDetails={groupDetails}
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* Search UI Popup */}
      {showSearch && (
        <SearchFilterPopup
          groupMembers={groupDetails.members}
          isOpen={showSearch}
          onClose={() => {
            setShowSearch(false);
            if (!searchQuery && selectedMembers.length === 0) {
              setIsSearching(false);
            }
          }}
          onSearch={handleSearch}
        />
      )}
    </div>
  );
}
