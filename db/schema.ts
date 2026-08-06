import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email", { length: 160 }).notNull(),
    name: text("name", { length: 100 }).notNull(),
    createdAt: text("created_at").notNull().default("now"),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
  }),
);

export const settlements = sqliteTable(
  "settlements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug", { length: 256 }).notNull().unique(),
    title: text("title", { length: 512 }).notNull(),
    category: text("category", { length: 80 }),
    status: text("status", { length: 40 }),
    deadline: text("deadline", { length: 20 }),
    daysLeft: integer("days_left"),
    estimatedAmount: text("estimated_amount", { length: 256 }),
    description: text("description"),
    claimUrl: text("claim_url", { length: 512 }),
    lastSeenAt: text("last_seen_at").notNull().default("now"),
    source: text("source", { length: 80 }).default("claimdepot"),
  },
  (table) => ({
    slugIdx: uniqueIndex("settlements_slug_idx").on(table.slug),
    statusIdx: uniqueIndex("settlements_status_idx").on(table.status),
  }),
);

// Junction table: users <-> saved settlements (bookmarked by a user)
export const savedSettlements = sqliteTable(
  "saved_settlements",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    settlementId: integer("settlement_id")
      .notNull()
      .references(() => settlements.id, { onDelete: "cascade" }),
    savedAt: text("saved_at").not null().default("now"),
  },
  (table) => ({
    userSettlementIdx: uniqueIndex("saved_settlements_user_settlement_idx").on(
      table.userId,
      table.settlementId,
    ),
  }),
);

export type User = typeof users.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type SavedSettlement = typeof savedSettlements.$inferSelect;
