"use client";

import { useState, useEffect, useRef } from "react";
import { FaSearch, FaTimes } from "react-icons/fa";

interface SearchOnFriendProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
}

export default function SearchOnFriend({
  isOpen,
  onClose,
  onSearch,
}: SearchOnFriendProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const popupRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popupRef.current &&
        !popupRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Reset states when popup is closed
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
    }
  }, [isOpen]);

  const handleSearch = () => {
    onSearch(searchQuery);
    if (!searchQuery.trim()) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-start justify-center pt-20 bg-black bg-opacity-30 z-50">
      <div
        ref={popupRef}
        className="bg-white rounded-lg shadow-lg overflow-hidden w-full max-w-md"
      >
        {/* Search Header */}
        <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <div className="flex flex-1 items-center">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaSearch className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Messages"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearch();
                  }
                }}
                autoFocus
              />
            </div>

            <button
              onClick={onClose}
              className="ml-2 p-2 hover:bg-gray-100 rounded-full"
            >
              <FaTimes size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Search Button Area */}
        <div className="px-6 py-4">
          <div className="flex justify-center items-center py-4">
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Search
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
