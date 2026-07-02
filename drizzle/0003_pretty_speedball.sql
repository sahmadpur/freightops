CREATE TYPE "public"."doc_counter_kind" AS ENUM('invoice', 'act');--> statement-breakpoint
ALTER TYPE "public"."doc_type" ADD VALUE 'act' BEFORE 'waybill';--> statement-breakpoint
CREATE TABLE "doc_counters" (
	"kind" "doc_counter_kind" NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "doc_counters_kind_year_pk" PRIMARY KEY("kind","year")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "act_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "act_date" date;