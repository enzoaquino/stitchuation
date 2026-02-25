CREATE TYPE "public"."material_type" AS ENUM('thread', 'bead', 'accessory', 'other');--> statement-breakpoint
CREATE TABLE "piece_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"material_type" "material_type" DEFAULT 'other' NOT NULL,
	"brand" text,
	"name" text NOT NULL,
	"code" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit" text,
	"notes" text,
	"acquired" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "piece_materials" ADD CONSTRAINT "piece_materials_piece_id_stitch_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."stitch_pieces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piece_materials" ADD CONSTRAINT "piece_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "piece_materials_piece_id_idx" ON "piece_materials" USING btree ("piece_id");--> statement-breakpoint
CREATE INDEX "piece_materials_user_id_updated_at_idx" ON "piece_materials" USING btree ("user_id","updated_at");