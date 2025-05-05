"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { toast } from "react-hot-toast";

export function RegisterForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [aboutMe, setAboutMe] = useState("");
  const [profilePictureUrl, setProfilePictureUrl] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password match
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    setLoading(true);

    try {
      // Send registration request to your backend with the complete payload
      const response = await fetch("http://localhost:8081/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          about_me: aboutMe,
          profile_picture_url:
            profilePictureUrl || "https://via.placeholder.com/150", // Default avatar if none provided
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Registration successful! Please login.");
        router.push("/"); // Redirect to login page
      } else {
        toast.error(data.message || "Registration failed. Please try again.");
      }
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#050C1B] relative overflow-hidden py-2">
      {/* Elliptical gradient decoration in the top left */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(27, 62, 136, 0.8) 0%, rgba(27, 62, 136, 0) 70%)",
        }}
      />

      {/* Elliptical gradient decoration in the bottom right */}
      <div
        className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(27, 62, 136, 0.8) 0%, rgba(27, 62, 136, 0) 70%)",
        }}
      />
      <div className="w-full max-w-lg p-4 lg:p-6 space-y-3 bg-[#050C1B]/50 backdrop-blur-md rounded-lg border border-blue-500/30 shadow-lg shadow-blue-500/20">
        <div className="flex justify-center">
          <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full overflow-hidden shadow-md shadow-blue-500/50">
            <img
              src="/images/voxtalogo.png"
              alt="Voxta Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <h2 className="text-xl lg:text-2xl font-bold text-center text-white">
          Create Your Account
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="first-name"
                className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
              >
                First Name
              </label>
              <input
                type="text"
                id="first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
                placeholder="Your first name"
              />
            </div>
            <div>
              <label
                htmlFor="last-name"
                className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
              >
                Last Name
              </label>
              <input
                type="text"
                id="last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
                placeholder="Your last name"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="username"
                className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
              >
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
                placeholder="Choose a username"
              />
            </div>

            <div>
              <label
                htmlFor="email"
                className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
              >
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
                placeholder="Your email address"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="phone-number"
              className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
            >
              Phone Number
            </label>
            <input
              type="tel"
              id="phone-number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
              placeholder="Your phone number"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="password"
                className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
              >
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
                  placeholder="Create a password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-blue-900 text-sm"
                >
                  {showPassword ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block mb-1 text-xs lg:text-sm font-medium text-blue-100"
              >
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full px-3 py-1.5 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50 text-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-2 text-blue-900 text-sm"
                >
                  {showPassword ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-2 mt-4 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none text-sm ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Loading..." : "Register"}
          </button>

          <p className="text-xs text-center text-blue-100 mt-2">
            Already have an account?{" "}
            <a
              href="/"
              className="text-blue-300 hover:text-blue-200 hover:underline"
            >
              Login
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
