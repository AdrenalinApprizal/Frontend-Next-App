"use client";

import { useState, useRef, useEffect } from "react";
import {
  FaUsers,
  FaFile,
  FaImage,
  FaTimes,
  FaLink,
  FaUser,
  FaUserPlus,
  FaEllipsisV,
  FaCheck,
  FaBan,
} from "react-icons/fa";
import { X, Search, UserMinus } from "lucide-react";

interface GroupProfileInfoProps {
  groupName: string;
  groupDetails: GroupDetails;
  onClose: () => void;
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

interface Friend {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  selected?: boolean;
}

export default function GroupProfileInfo({
  groupName,
  groupDetails: initialGroupDetails,
  onClose,
}: GroupProfileInfoProps) {
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

  const [groupDetails, setGroupDetails] =
    useState<GroupDetails>(initialGroupDetails);

  const blockedMembersCount = groupDetails.members.filter(
    (member) => member.isBlocked
  ).length;

  const [friends, setFriends] = useState<Friend[]>([
    { id: "101", name: "Rudi Setiawan", username: "rudi", avatar: undefined },
    { id: "102", name: "Lina Kartika", username: "lina", avatar: undefined },
    { id: "103", name: "Budi Santoso", username: "budi", avatar: undefined },
    { id: "104", name: "Ratna Dewi", username: "ratna", avatar: undefined },
    { id: "105", name: "Dimas Prasetyo", username: "dimas", avatar: undefined },
  ]);

  const [expandedSection, setExpandedSection] = useState<string | null>(
    "members"
  );

  const [showAddMemberPopup, setShowAddMemberPopup] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setActiveDropdown(null);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredFriends = friends.filter(
    (friend) =>
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleMemberDropdown = (memberId: string) => {
    setActiveDropdown(activeDropdown === memberId ? null : memberId);
  };

  const handleBlockMember = (memberId: string) => {
    setGroupDetails((prevDetails) => ({
      ...prevDetails,
      members: prevDetails.members.map((member) =>
        member.id === memberId ? { ...member, isBlocked: true } : member
      ),
    }));
    setActiveDropdown(null);
  };

  const handleUnblockMember = (memberId: string) => {
    setGroupDetails((prevDetails) => ({
      ...prevDetails,
      members: prevDetails.members.map((member) =>
        member.id === memberId ? { ...member, isBlocked: false } : member
      ),
    }));
    setActiveDropdown(null);
  };

  const toggleFriendSelection = (id: string) => {
    setFriends((prevFriends) =>
      prevFriends.map((friend) =>
        friend.id === id ? { ...friend, selected: !friend.selected } : friend
      )
    );
  };

  const handleAddMembers = () => {
    setShowAddMemberPopup(false);
    setSearchQuery("");
    alert("Members have been invited to the group!");
    setFriends((prevFriends) =>
      prevFriends.map((friend) => ({ ...friend, selected: false }))
    );
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white overflow-y-auto h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div></div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <FaTimes size={20} />
          </button>
        </div>

        <div className="flex flex-col items-center">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-200 mb-3 flex items-center justify-center">
            {groupDetails.avatar ? (
              <img
                src={groupDetails.avatar}
                alt={groupDetails.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <FaUsers className="h-12 w-12 text-gray-400" />
            )}
          </div>
          <h2 className="text-xl font-semibold">{groupName}</h2>
          <p className="text-gray-500 text-sm">{groupDetails.description}</p>
        </div>
      </div>

      {/* Members Section */}
      <div className="border-b border-gray-200">
        <div
          className="p-4 flex justify-between items-center cursor-pointer"
          onClick={() =>
            setExpandedSection(expandedSection === "members" ? null : "members")
          }
        >
          <div className="flex items-center">
            <h3 className="font-medium">
              Members{" "}
              <span className="text-gray-500">
                ({groupDetails.memberCount})
              </span>
            </h3>
          </div>
          <div className="text-gray-500 text-sm">
            {expandedSection === "members" ? "▲" : "▼"}
          </div>
        </div>

        {expandedSection === "members" && (
          <div className="px-4 pb-4">
            {blockedMembersCount > 0 && (
              <p className="text-xs text-red-500 mb-3">
                {blockedMembersCount} person{blockedMembersCount > 1 ? "s" : ""}{" "}
                blocked
              </p>
            )}

            <button
              onClick={() => setShowAddMemberPopup(true)}
              className="mb-4 flex items-center text-blue-500 hover:text-blue-600 text-sm"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                <FaUserPlus className="h-4 w-4" />
              </div>
              Add Member
            </button>

            <div className="space-y-3">
              {groupDetails.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 mr-2 flex items-center justify-center">
                      {member.avatar ? (
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FaUser className="h-4 w-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex items-center">
                      <span className="text-sm">{member.name}</span>
                      {member.isBlocked && (
                        <div className="ml-2 text-red-500" title="Blocked user">
                          <FaBan size={12} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      className="text-gray-400 hover:text-gray-600"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMemberDropdown(member.id);
                      }}
                    >
                      <FaEllipsisV size={12} />
                    </button>
                    {activeDropdown === member.id && (
                      <div
                        ref={dropdownRef}
                        className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-lg z-10"
                      >
                        <button
                          className="flex w-full text-left px-4 py-2 text-sm hover:bg-gray-100 items-center"
                          onClick={() =>
                            member.isBlocked
                              ? handleUnblockMember(member.id)
                              : handleBlockMember(member.id)
                          }
                        >
                          {member.isBlocked ? (
                            <>
                              <UserMinus
                                className="inline-block mr-2"
                                size={16}
                              />
                              <span className="text-green-600">
                                Unblock User
                              </span>
                            </>
                          ) : (
                            <>
                              <FaBan className="inline-block mr-2" size={16} />
                              <span className="text-red-600">Block User</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
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

      {/* Add Member Popup */}
      {showAddMemberPopup && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Add Members</h2>
              <button
                onClick={() => setShowAddMemberPopup(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="relative mb-4">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="max-h-60 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
              {filteredFriends.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No friends found
                </div>
              ) : (
                filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className={`flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 ${
                      friend.selected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => toggleFriendSelection(friend.id)}
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-200 mr-3 flex items-center justify-center">
                        {friend.avatar ? (
                          <img
                            src={friend.avatar}
                            alt={friend.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FaUser className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{friend.name}</p>
                        <p className="text-gray-500 text-xs">
                          @{friend.username}
                        </p>
                      </div>
                    </div>
                    {friend.selected && (
                      <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                        <FaCheck className="h-3 w-3 text-white" />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowAddMemberPopup(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMembers}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                disabled={!friends.some((friend) => friend.selected)}
              >
                Add to Group
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
