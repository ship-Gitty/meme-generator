import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      role: "user" | "admin";
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: "user" | "admin";
  }
}
