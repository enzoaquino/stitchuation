CREATE INDEX "canvases_user_id_idx" ON "canvases" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "canvases_user_id_updated_at_idx" ON "canvases" USING btree ("user_id","updated_at");