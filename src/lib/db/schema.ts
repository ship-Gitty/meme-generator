import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  integer,
  uuid,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";

// SPEC.md Section 14: users.role — defaults to `user`, never user-settable via any API route.
export const roleEnum = pgEnum("role", ["user", "admin"]);

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: roleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

// Required by @auth/drizzle-adapter for OAuth providers (Google).
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

// Required by @auth/drizzle-adapter for database session strategy.
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

// Required by @auth/drizzle-adapter; unused while Google OAuth is the only provider.
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

export const sourceTypeEnum = pgEnum("source_type", ["static", "animated"]);
// Reserved for a future sharing feature (R12) — unused in Phase 1/2/3.
export const visibilityEnum = pgEnum("visibility", ["private", "public"]);

// SPEC.md Section 14.
export const memes = pgTable("memes", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  caption: text("caption").notNull(),
  imageUrl: text("image_url").notNull(),
  textStyle: jsonb("text_style").notNull(),
  sourceType: sourceTypeEnum("source_type").notNull().default("static"),
  visibility: visibilityEnum("visibility").notNull().default("private"),
  shareSlug: text("share_slug"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});
