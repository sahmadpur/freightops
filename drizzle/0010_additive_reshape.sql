CREATE TYPE "public"."customs_item_category" AS ENUM('documentation_fee', 'declaration_main_page', 'declaration_additional_page', 'short_declaration', 'broker_fee', 'inspector_fee', 'handling', 'terminal', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."finance_category" AS ENUM('customs', 'broker', 'terminal', 'warehouse', 'loading', 'transport', 'insurance', 'certification', 'demurrage', 'bank_fee', 'other');--> statement-breakpoint
ALTER TYPE "public"."document_parent" ADD VALUE 'customs_clearance';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'waiting_pickup' BEFORE 'received';--> statement-breakpoint
CREATE TABLE "customs_clearance_items" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clearance_id" text NOT NULL,
	"category" "customs_item_category" NOT NULL,
	"buy_amount" numeric(12, 2),
	"sell_amount" numeric(12, 2),
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customs_clearances" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"order_id" text,
	"account_id" text,
	"declaration_number" text,
	"description" text,
	"currency" text DEFAULT 'USD' NOT NULL,
	"exchange_rate" numeric(12, 4),
	"cleared_at" date,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "customs_clearances_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"rate_date" date NOT NULL,
	"code" text NOT NULL,
	"nominal" integer NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_rate_date_code_pk" PRIMARY KEY("rate_date","code")
);
--> statement-breakpoint
CREATE TABLE "monthly_counters" (
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"month" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "monthly_counters_kind_year_month_pk" PRIMARY KEY("kind","year","month")
);
--> statement-breakpoint
ALTER TABLE "order_finance_lines" ADD COLUMN "category" "finance_category" DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "rollback_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "transport_type" "mode_type";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "from_country" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "to_country" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cargo_items" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "customs_clearance_items" ADD CONSTRAINT "customs_clearance_items_clearance_id_customs_clearances_id_fk" FOREIGN KEY ("clearance_id") REFERENCES "public"."customs_clearances"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customs_clearances" ADD CONSTRAINT "customs_clearances_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customs_clearances" ADD CONSTRAINT "customs_clearances_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customs_clearances" ADD CONSTRAINT "customs_clearances_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customs_clearance_items_clearance_id_idx" ON "customs_clearance_items" USING btree ("clearance_id");--> statement-breakpoint
CREATE INDEX "customs_clearances_order_id_idx" ON "customs_clearances" USING btree ("order_id");