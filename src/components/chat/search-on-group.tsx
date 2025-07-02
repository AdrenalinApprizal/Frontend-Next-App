"use client";

import { useState, useEffect, useRef } from "react";
import { FaSearch, FaFilter, FaUser, FaTimes } from "react-icons/fa";
import { X } from "lucide-react";

interface GroupMember {
  id: string;
  name: string;
  status: "online" | "offline";
  role: "admin" | "member" | "owner";
  avatar?: string;
  avatar_url?: string; // Added to support compatibility
}

interface SearchFilterPopupProps {
  groupMembers: GroupMember[];
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string, selectedMembers: string[]) => void;
}

export default function SearchFilterPopup({
  groupMembers,
  isOpen,
  onClose,
  onSearch,
}: SearchFilterPopupProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [filtersApplied, setFiltersApplied] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

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
      setShowFilter(false);
      if (!filtersApplied) {
        setSelectedMembers([]);
        setSearchQuery("");
      }
    }
  }, [isOpen, filtersApplied]);

  // Filter members based on search query
  const filteredMembers = memberSearchQuery
    ? groupMembers.filter((member) =>
        member.name.toLowerCase().includes(memberSearchQuery.toLowerCase())
      )
    : groupMembers;

  // Group members by first letter of name for alphabetical organization
  const groupedMembers: Record<string, GroupMember[]> = {};
  filteredMembers.forEach((member) => {
    const firstLetter = member.name.charAt(0).toUpperCase();
    if (!groupedMembers[firstLetter]) {
      groupedMembers[firstLetter] = [];
    }
    groupedMembers[firstLetter].push(member);
  });

  const handleSearch = () => {
    onSearch(searchQuery, selectedMembers);
    if (selectedMembers.length > 0) {
      setFiltersApplied(true);
    }
  };

  const clearFilters = () => {
    setSelectedMembers([]);
    setFiltersApplied(false);
    onSearch(searchQuery, []);
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
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                if (value === "") {
                // Instead of refreshing the page, trigger a search with empty query and current filters
                onSearch("", selectedMembers);
                }
              }}
              placeholder="Search Messages"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                handleSearch();
                }
              }}
              />
            </div>

            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`ml-3 p-2 rounded-full ${
                filtersApplied
                  ? "bg-blue-500 text-white"
                  : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <FaFilter size={16} />
            </button>

            <button
              onClick={onClose}
              className="ml-2 p-2 hover:bg-gray-100 rounded-full"
            >
              <FaTimes size={20} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Filter Content */}
        {showFilter ? (
          <div className="bg-white rounded">
            <div className="px-6 py-3 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-medium">Search Filter</h2>
              <button
                onClick={() => setShowFilter(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-4">
              <p className="text-sm text-gray-500 mb-4">
                {filtersApplied ? "Filters Applied" : "No Filters Applied"}
              </p>

              <div className="relative mb-4">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FaSearch className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                  placeholder="Search by name"
                  className="w-full pl-10 py-2 bg-gray-100 border border-gray-200 rounded-lg focus:outline-none"
                />
              </div>

              <div className="mt-2 max-h-60 overflow-y-auto">
                {Object.keys(groupedMembers)
                  .sort()
                  .map((letter) => (
                    <div key={letter}>
                      <div className="mb-2 text-xs text-gray-500">{letter}</div>
                      {groupedMembers[letter].map((member) => (
                        <div
                          key={member.id}
                          className="flex items-center justify-between py-2"
                        >
                          <div className="flex items-center">
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-200 mr-3">
                              {member.avatar_url || member.avatar ? (
                                <img
                                  src={member.avatar_url || member.avatar}
                                  alt={member.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FaUser className="h-5 w-5 m-auto text-gray-500" />
                              )}
                            </div>
                            <span>{member.name}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedMembers.includes(member.id)}
                            onChange={() => {
                              setSelectedMembers((prev) =>
                                prev.includes(member.id)
                                  ? prev.filter((id) => id !== member.id)
                                  : [...prev, member.id]
                              );
                            }}
                            className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      ))}
                    </div>
                  ))}

                {Object.keys(groupedMembers).length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    No members found
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setSelectedMembers([]);
                    setShowFilter(false);
                    setFiltersApplied(false);
                    clearFilters();
                  }}
                  className="px-4 py-2 text-gray-700 rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowFilter(false);
                    setFiltersApplied(selectedMembers.length > 0);
                    handleSearch();
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
            {filtersApplied && (
              <div className="px-4 py-2 bg-blue-50 flex items-center rounded mb-4">
                <span className="mr-2 text-sm text-blue-700">
                  {selectedMembers.length}{" "}
                  {selectedMembers.length === 1 ? "person" : "people"} added to
                  the filter
                </span>
                <button
                  onClick={clearFilters}
                  className="ml-auto text-blue-700 hover:text-blue-800"
                >
                  Clear
                </button>
              </div>
            )}

            <div className="flex justify-center items-center py-4">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
