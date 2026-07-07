CREATE TYPE "public"."finance_line_side" AS ENUM('revenue', 'cost');--> statement-breakpoint
CREATE TABLE "order_finance_lines" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" text NOT NULL,
	"side" "finance_line_side" NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "order_finance_lines" ADD CONSTRAINT "order_finance_lines_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_finance_lines" ADD CONSTRAINT "order_finance_lines_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_finance_lines_order_id_idx" ON "order_finance_lines" USING btree ("order_id");--> statement-breakpoint
-- Backfill: migrate existing scalar amounts into itemized finance lines BEFORE dropping the columns.
INSERT INTO "order_finance_lines" ("order_id", "side", "description", "amount", "created_by")
SELECT "id", 'revenue', 'Freight forwarding services', "client_charge", "created_by"
FROM "orders" WHERE "client_charge" IS NOT NULL;--> statement-breakpoint
INSERT INTO "order_finance_lines" ("order_id", "side", "description", "amount", "created_by")
SELECT "id", 'cost', 'Carrier cost', "carrier_cost", "created_by"
FROM "orders" WHERE "carrier_cost" IS NOT NULL;--> statement-breakpoint
INSERT INTO "order_finance_lines" ("order_id", "side", "description", "amount", "note", "created_by")
SELECT "id", 'cost', COALESCE("additional_costs_note", 'Additional costs'), "additional_costs", "additional_costs_note", "created_by"
FROM "orders" WHERE "additional_costs" IS NOT NULL;--> statement-breakpoint
-- Fold the old additional costs into the carrier_cost rollup (= Σ cost lines).
UPDATE "orders" SET "carrier_cost" = COALESCE("carrier_cost", 0) + COALESCE("additional_costs", 0)
WHERE "additional_costs" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "additional_costs";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "additional_costs_note";--> statement-breakpoint
ALTER TABLE "orders" DROP COLUMN "expected_profit";