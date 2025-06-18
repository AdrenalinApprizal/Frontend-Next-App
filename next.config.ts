/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable experimental features for production
  experimental: {
    // Enable server actions
    serverActions: {
      allowedOrigins: ["*.vercel.app", "localhost:3000"],
    },
  },

  // Image optimization settings
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "",
      },
      {
        protocol: "https",
        hostname: "*.vercel.app",
      },
    ],
    unoptimized: false,
  },

  // Headers for better security and CORS
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,OPTIONS,PATCH,DELETE,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
        ],
      },
    ];
  },

  // Environment variables that should be available on the client
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  // Webpack configuration for WebSocket support
  webpack: (config: any, { isServer }: { isServer: boolean }) => {
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

  // Transpile packages for better compatibility
  transpilePackages: ["socket.io-client", "socket.io"],

  // Optimize for serverless functions
  poweredByHeader: false,

  // Enable SWC minification
  swcMinify: true,
};

export default nextConfig;
