CREATE TABLE "quotations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"expected_cost_total" numeric(12, 2),
	"selling_price" numeric(12, 2),
	"valid_until" date,
	"transit_time_days" integer,
	"terms" text,
	"notes" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text
);
--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quotations_request_id_idx" ON "quotations" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quotations_request_version_idx" ON "quotations" USING btree ("request_id","version");