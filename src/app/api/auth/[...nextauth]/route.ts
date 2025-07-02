import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Define our auth handler
const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
       
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required");
          }

          // Use the proxy endpoint instead of directly connecting to the backend
          const authUrl = `${
            process.env.NEXTAUTH_URL || ""
          }/api/proxy/auth/login`;

          const response = await fetch(authUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
            cache: "no-store",
          });


          const data = await response.json();

          if (!response.ok) {
            console.error(
              `Auth API error: ${response.status} ${response.statusText}`,
              data
            );
            // Throw specific error message if available from API
            throw new Error(
              data?.message ||
                data?.error ||
                `Authentication failed: ${response.statusText}`
            );
          }

          if (!data || !data.access_token) {
            throw new Error("Invalid response from authentication server");
          }


          // Return user data
          return {
            id: data.user_id || data.id,
            name: data.username || data.name || data.email,
            email: data.email,
            access_token: data.access_token,
            expiresAt: data.expires_at || data.expiresAt,
          };
        } catch (error) {
          console.error("Authentication error:", error);
          throw error; // Re-throw to let NextAuth handle the error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      ({
        tokenExists: !!token,
        userExists: !!user,
        userAccessToken: user?.access_token ? "Present" : "Missing",
      });

      if (user) {
        token.access_token = user.access_token;
        token.expiresAt = user.expiresAt;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      ( {
        sessionExists: !!session,
        tokenExists: !!token,
        tokenAccessToken: token?.access_token ? "Present" : "Missing",
      });

      // Use type assertion to ensure TypeScript recognizes these properties
      session.access_token = token.access_token as string;
      session.expiresAt = token.expiresAt as string;

      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/",
    signOut: "/",
    error: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
});

// Export the GET and POST functions
export const GET = handler;
export const POST = handler;


