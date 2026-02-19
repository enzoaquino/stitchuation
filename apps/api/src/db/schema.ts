import { pgTable, uuid, text, timestamp, integer, pgEnum } from "drizzle-orm/pg-core";

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
});
