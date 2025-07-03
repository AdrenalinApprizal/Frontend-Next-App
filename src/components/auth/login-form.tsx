"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { signIn } from "next-auth/react";
import { toast } from "react-hot-toast";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
    
      // Real authentication with your backend via NextAuth
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        // Extract more useful error message if available
        let errorMessage =
          "Authentication failed. Please check your credentials.";

        // Check for specific error types
        if (result.error === "CredentialsSignin") {
          errorMessage = "Invalid email or password. Please try again.";
        } else if (result.error.includes("Email and password are required")) {
          errorMessage = "Email and password are required.";
        } else if (result.error.includes("Authentication failed")) {
          // Use the specific error message from the backend if available
          errorMessage = result.error;
        }

        setErrorMsg(errorMessage);
        toast.error(errorMessage);
      } else if (result?.ok) {
        toast.success("Login successful!");
        // Add a small delay to ensure the session is properly set
        setTimeout(() => {
          router.push("/chat/messages");
        }, 100);
      } else {
        setErrorMsg("An unexpected error occurred. Please try again.");
        toast.error("An unexpected error occurred.");
      }
    } catch (error) {
      setErrorMsg("An error occurred during login.");
      toast.error("An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative bg-[#050C1B] overflow-hidden">
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

      {/* Main background gradient */}
      <div
        className="absolute inset-0 z-0 opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(27, 62, 136, 0.8) 0%, rgba(27, 62, 136, 0) 70%)",
        }}
      />
      <div className="w-full max-w-md p-12 space-y-6 bg-[#050C1B]/50 backdrop-blur-md rounded-lg border border-blue-500/30 shadow-lg shadow-blue-500/20 z-10">
        <div className="flex justify-center">
          <div className="w-24 h-24 rounded-full overflow-hidden shadow-md shadow-blue-500/50">
            <img
              src="/images/voxtalogo.png"
              alt="Voxta Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-white">
          Sign In to Your Account
        </h2>
        {errorMsg && (
          <div className="bg-red-500/20 border border-red-500 text-white px-4 py-2 rounded">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="email"
              className="block mb-2 text-sm font-medium text-blue-100"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50"
              placeholder="Enter your email"
            />
          </div>
          <div className="mb-4">
            <label
              htmlFor="password"
              className="block mb-2 text-sm font-medium text-blue-100"
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
                className="w-full px-4 py-2 bg-white border border-blue-500/30 rounded text-[#050C1B] focus:outline-none focus:ring focus:ring-blue-500 placeholder-[#050C1B]/70 placeholder-opacity-50"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-blue-900"
              >
                {showPassword ? <FaEye /> : <FaEyeSlash />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full px-4 py-2 font-bold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none ${
              loading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loading ? "Loading..." : "Login"}
          </button>
          <p className="mt-4 text-sm text-center text-blue-100">
            Don't have an account?{" "}
            <a
              href="/register"
              className="text-blue-300 hover:text-blue-200 hover:underline"
            >
              Register
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
