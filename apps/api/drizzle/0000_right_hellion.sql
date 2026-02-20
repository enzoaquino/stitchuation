CREATE TYPE "public"."fiber_type" AS ENUM('wool', 'cotton', 'silk', 'synthetic', 'blend', 'other');--> statement-breakpoint
CREATE TYPE "public"."piece_status" AS ENUM('stash', 'kitting', 'wip', 'stitched', 'at_finishing', 'finished');--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "journal_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"image_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stitch_pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"designer" text NOT NULL,
	"design_name" text NOT NULL,
	"status" "piece_status" DEFAULT 'stash' NOT NULL,
	"image_key" text,
	"size" text,
	"mesh_count" integer,
	"notes" text,
	"acquired_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"stitched_at" timestamp with time zone,
	"finishing_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand" text NOT NULL,
	"number" text NOT NULL,
	"color_name" text,
	"color_hex" text,
	"fiber_type" "fiber_type" DEFAULT 'wool' NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"barcode" text,
	"weight_or_length" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text,
	"provider" text DEFAULT 'email' NOT NULL,
	"provider_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_piece_id_stitch_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."stitch_pieces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_images" ADD CONSTRAINT "journal_images_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stitch_pieces" ADD CONSTRAINT "stitch_pieces_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_entries_piece_id_idx" ON "journal_entries" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "journal_entries_user_id_updated_at_idx" ON "journal_entries" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "journal_images_entry_id_idx" ON "journal_images" USING btree ("entry_id");--> statement-breakpoint
CREATE INDEX "journal_images_entry_id_updated_at_idx" ON "journal_images" USING btree ("entry_id","updated_at");--> statement-breakpoint
CREATE INDEX "stitch_pieces_user_id_idx" ON "stitch_pieces" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stitch_pieces_user_id_updated_at_idx" ON "stitch_pieces" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "stitch_pieces_user_id_status_idx" ON "stitch_pieces" USING btree ("user_id","status");