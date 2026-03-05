CREATE TYPE "public"."thread_format" AS ENUM('skein', 'card', 'hank', 'spool', 'ball', 'cone', 'other');--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "format" "thread_format";