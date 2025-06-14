import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable experimental features for production
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ["*.vercel.app", "localhost:3000"]
    }
  },
  
  // Image optimization settings
  images: {
    domains: ["localhost", "*.vercel.app"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
      },
    ],
  },

  // Headers for better security and CORS
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  },

  // Environment variables that should be available on the client
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  // Webpack configuration for WebSocket support
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
      };
    }
    return config;
  },

  // Output configuration for Vercel
  output: 'standalone',
};

export default nextConfig;
