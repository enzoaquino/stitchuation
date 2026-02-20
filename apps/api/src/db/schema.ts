import { pgTable, uuid, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";

export const fiberTypeEnum = pgEnum("fiber_type", [
  "wool", "cotton", "silk", "synthetic", "blend", "other"
]);

export const pieceStatusEnum = pgEnum("piece_status", [
  "stash", "kitting", "wip", "stitched", "at_finishing", "finished"
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash"),
  provider: text("provider").notNull().default("email"),
  providerUserId: text("provider_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const threads = pgTable("threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  brand: text("brand").notNull(),
  number: text("number").notNull(),
  colorName: text("color_name"),
  colorHex: text("color_hex"),
  fiberType: fiberTypeEnum("fiber_type").notNull().default("wool"),
  quantity: integer("quantity").notNull().default(0),
  barcode: text("barcode"),
  weightOrLength: text("weight_or_length"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const stitchPieces = pgTable("stitch_pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  designer: text("designer").notNull(),
  designName: text("design_name").notNull(),
  status: pieceStatusEnum("status").notNull().default("stash"),
  imageKey: text("image_key"),
  size: text("size"),
  meshCount: integer("mesh_count"),
  notes: text("notes"),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }),
  startedAt: timestamp("started_at", { withTimezone: true }),
  stitchedAt: timestamp("stitched_at", { withTimezone: true }),
  finishingAt: timestamp("finishing_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("stitch_pieces_user_id_idx").on(table.userId),
  index("stitch_pieces_user_id_updated_at_idx").on(table.userId, table.updatedAt),
  index("stitch_pieces_user_id_status_idx").on(table.userId, table.status),
]);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  pieceId: uuid("piece_id").notNull().references(() => stitchPieces.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("journal_entries_piece_id_idx").on(table.pieceId),
  index("journal_entries_user_id_updated_at_idx").on(table.userId, table.updatedAt),
]);

export const journalImages = pgTable("journal_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").notNull().references(() => journalEntries.id),
  imageKey: text("image_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("journal_images_entry_id_idx").on(table.entryId),
  index("journal_images_entry_id_updated_at_idx").on(table.entryId, table.updatedAt),
]);
