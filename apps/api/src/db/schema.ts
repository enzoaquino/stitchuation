import { pgTable, uuid, text, timestamp, integer, pgEnum, index } from "drizzle-orm/pg-core";

export const fiberTypeEnum = pgEnum("fiber_type", [
  "wool", "cotton", "silk", "synthetic", "blend", "other"
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

export const canvases = pgTable("canvases", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  designer: text("designer").notNull(),
  designName: text("design_name").notNull(),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }),
  imageKey: text("image_key"),
  size: text("size"),
  meshCount: integer("mesh_count"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("canvases_user_id_idx").on(table.userId),
  index("canvases_user_id_updated_at_idx").on(table.userId, table.updatedAt),
]);

export const projectStatusEnum = pgEnum("project_status", [
  "wip", "at_finishing", "completed"
]);

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  canvasId: uuid("canvas_id").notNull().references(() => canvases.id).unique(),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: projectStatusEnum("status").notNull().default("wip"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishingAt: timestamp("finishing_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("projects_user_id_idx").on(table.userId),
  index("projects_canvas_id_idx").on(table.canvasId),
  index("projects_user_id_updated_at_idx").on(table.userId, table.updatedAt),
]);

export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("journal_entries_project_id_idx").on(table.projectId),
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
