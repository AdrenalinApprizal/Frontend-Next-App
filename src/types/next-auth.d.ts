import "next-auth";
import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  /**
   * Extending the built-in Session type
   */
  interface Session {
    access_token?: string;
    expiresAt?: string;
    user: {
      id?: string;
      name?: string;
      email?: string;
      image?: string;
    } & DefaultSession["user"]
  }

  /**
   * Extending the built-in JWT type
   */
  interface JWT {
    access_token?: string;
    expiresAt?: string;
    id?: string;
  }

  /**
   * Extending the built-in User type
   */
  interface User extends DefaultUser {
    access_token?: string;
    expiresAt?: string;
    id: string;
  }
}