"use client";

import { useState, useRef, useEffect } from "react";
import {
  FaUser,
  FaPaperPlane,
  FaImage,
  FaFile,
  FaEllipsisV,
  FaCheck,
  FaCheckDouble,
  FaSearch,
} from "react-icons/fa";
import { Paperclip, X, Edit2, Trash } from "lucide-react";
import FriendProfileInfo from "./friend-profile-info";
import SearchOnFriend from "./search-on-friend";

interface ChatAreaProps {
  recipientId: string;
  recipientName: string;
}

interface Message {
  id: string;
  content: string;
  timestamp: string;
  isCurrentUser: boolean;
  read?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
  attachment?: {
    type: "image" | "file";
    url: string;
    name: string;
    size?: string;
  };
}

export function ChatArea({ recipientId, recipientName }: ChatAreaProps) {
  const [messages, setMessages] = useState<Message[]>(() => {
    return [
      {
        id: "1",
        content: "Hi there!",
        timestamp: "10:20 AM",
        isCurrentUser: false,
        read: true,
      },
      {
        id: "2",
        content: "Hello! How are you?",
        timestamp: "10:22 AM",
        isCurrentUser: true,
        read: true,
      },
      {
        id: "3",
        content: "I'm good, thanks for asking. How about you?",
        timestamp: "10:25 AM",
        isCurrentUser: false,
        read: true,
      },
      {
        id: "4",
        content: "I'm doing well! Just working on that project we discussed.",
        timestamp: "10:30 AM",
        isCurrentUser: true,
        read: false,
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);

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

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " bytes";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newMessage: Message = {
        id: `${messages.length + 1}`,
        content: "",
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newMessage: Message = {
        id: `${messages.length + 1}`,
        content: "",
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = () => {
    if (inputMessage.trim()) {
      if (editingMessageId) {
        setMessages(
          messages.map((message) =>
            message.id === editingMessageId
              ? { ...message, content: inputMessage, isEdited: true }
              : message
          )
        );
        setEditingMessageId(null);
      } else {
        const newMessage: Message = {
          id: `${messages.length + 1}`,
          content: inputMessage,
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

  const handleSearch = (query: string) => {
    if (!query.trim()) {
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const filtered = messages.filter((message) =>
      message.content.toLowerCase().includes(query.toLowerCase())
    );
    setFilteredMessages(filtered);
  };

  const displayMessages = isSearching ? filteredMessages : messages;

  const onlineStatus =
    recipientId === "1" || recipientId === "3" ? "online" : "offline";

  const friendDetails = {
    id: recipientId,
    name: recipientName,
    email: `${recipientName.toLowerCase().replace(/\s/g, ".")}@example.com`,
    phone: "+1 555-123-4567",
    joinDate: "January 15, 2025",
    location: "New York, USA",
    status: onlineStatus as "online" | "offline",
  };

  return (
    <div className="h-full flex bg-gray-50">
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-4 bg-white border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center">
            <div className="relative mr-3">
              <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
                <FaUser className="h-6 w-6 text-gray-500" />
              </div>
              {onlineStatus === "online" && (
                <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
              )}
            </div>
            <div>
              <h2 className="font-semibold">{recipientName}</h2>
              <p className="text-xs text-gray-500">
                {onlineStatus === "online" ? "Online" : "Offline"}
              </p>
            </div>
          </div>

          <div className="flex items-center">
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
              title="Search in conversation"
            >
              <FaSearch size={18} />
            </button>
            <button
              onClick={() => setShowProfile(!showProfile)}
              className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200"
              title="Message options"
            >
              <FaEllipsisV size={18} />
            </button>
          </div>
        </div>

        {showSearch && (
          <SearchOnFriend
            isOpen={showSearch}
            onClose={() => {
              setShowSearch(false);
              setIsSearching(false);
            }}
            onSearch={handleSearch}
          />
        )}

        <div className="flex-1 overflow-auto p-6 space-y-4 relative">
          {displayMessages.length === 0 && isSearching ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-gray-500">
                <p className="mb-1">No matching messages found</p>
                <button
                  onClick={() => {
                    setIsSearching(false);
                    setShowSearch(false);
                  }}
                  className="text-blue-500 hover:underline"
                >
                  Clear search
                </button>
              </div>
            </div>
          ) : (
            displayMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.isCurrentUser ? "justify-end" : "justify-start"
                } mb-4`}
              >
                <div className="flex flex-col max-w-[70%]">
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
                            {message.attachment.name} ({message.attachment.size}
                            )
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
                      {message.isCurrentUser && (
                        <span>
                          {message.read ? (
                            <FaCheckDouble
                              className="h-3 w-3 text-blue-100"
                              title="Read"
                            />
                          ) : (
                            <FaCheck
                              className="h-3 w-3 text-blue-100"
                              title="Sent"
                            />
                          )}
                        </span>
                      )}
                    </div>

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
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

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
            <div className="relative">
              <button
                onClick={handleAttachmentClick}
                className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-blue-500 transition-colors duration-200 mr-2"
                title="Attach file"
              >
                <Paperclip size={20} />
              </button>
              {isAttachmentMenuOpen && (
                <div className="absolute top-12 left-0 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
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
            </div>
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
        <FriendProfileInfo
          friendDetails={friendDetails}
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
