import type { NextAuthOptions } from "next-auth";

export const authOptions: NextAuthOptions = {
  providers: [
    {
      id: "identityserver",
      name: "IdentityServer",
      type: "oauth",

      // IdentityServer endpoints - using well-known configuration
      wellKnown: "http://localhost:5002/.well-known/openid-configuration",

      clientId: process.env.IDENTITYSERVER_CLIENT_ID || "nextjs-chatbot",
      clientSecret: process.env.IDENTITYSERVER_CLIENT_SECRET || "chatbot-secret-key-2024",

      authorization: {
        params: {
          scope: "openid profile email chatbot_api offline_access",
          response_type: "code",
        },
      },

      // Enable PKCE (Proof Key for Code Exchange) - required by IdentityServer
      checks: ["pkce", "state"],

      idToken: true,

      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username || profile.email,
          email: profile.email,
          image: profile.picture,
        };
      },
    },
  ],

  callbacks: {
    async jwt({ token, account }) {
      // Store access_token for API calls
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
        token.idToken = account.id_token;
      }
      return token;
    },

    async session({ session, token }) {
      // Pass access_token to client
      session.accessToken = token.accessToken as string;
      if (session.user) {
        session.user.id = token.sub as string;
      }
      return session;
    },
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  debug: process.env.NODE_ENV === "development",
};
