CREATE TYPE "public"."preferred_channel" AS ENUM('email', 'phone', 'whatsapp', 'other');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'supervisor' BEFORE 'client';--> statement-breakpoint
CREATE TABLE "annual_counters" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "annual_counters_kind_year_pk" PRIMARY KEY("kind","year")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "phones" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "email_domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "position" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "whatsapp" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "preferred_channel" "preferred_channel";--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "notes" text;--> statement-breakpoint
CREATE INDEX "contacts_parent_idx" ON "contacts" USING btree ("parent_type","parent_id");