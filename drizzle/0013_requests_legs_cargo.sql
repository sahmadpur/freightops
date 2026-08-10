CREATE TYPE "public"."container_type" AS ENUM('20dc', '40dc', '40hc', '45hc', '20rf', '40rf', 'open_top', 'flat_rack', 'other');--> statement-breakpoint
CREATE TYPE "public"."lead_source" AS ENUM('email', 'whatsapp', 'phone', 'website', 'agent', 'partner', 'tender', 'other');--> statement-breakpoint
CREATE TYPE "public"."lost_reason" AS ENUM('price_too_high', 'chose_competitor', 'transit_time', 'no_solution', 'no_response', 'cargo_cancelled', 'informational_only', 'other');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('new', 'in_progress', 'quotation', 'quotation_sent', 'waiting_client', 'won', 'lost', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."routing_preference" AS ENUM('direct', 'transit', 'none');--> statement-breakpoint
CREATE TYPE "public"."shipment_parent" AS ENUM('request', 'order');--> statement-breakpoint
CREATE TYPE "public"."stackable" AS ENUM('yes', 'no', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."transport_family" AS ENUM('road', 'sea', 'rail', 'air', 'multimodal');--> statement-breakpoint
CREATE TYPE "public"."transport_subtype" AS ENUM('ftl', 'ltl', 'fcl', 'lcl', 'breakbulk', 'roro', 'rail_container', 'wagon', 'rail_lcl');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('curtainsider', 'reefer', 'mega', 'box', 'container_chassis', 'isothermal', 'lowbed', 'other');--> statement-breakpoint
CREATE TYPE "public"."wagon_type" AS ENUM('covered', 'gondola', 'platform', 'tank', 'hopper', 'refrigerated', 'other');--> statement-breakpoint
CREATE TABLE "cargo_details" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_type" "shipment_parent" NOT NULL,
	"parent_id" text NOT NULL,
	"description" text,
	"hs_codes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"packages" integer,
	"gross_weight_kg" numeric(12, 2),
	"volume_m3" numeric(12, 2),
	"dimensions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cargo_value" numeric(14, 2),
	"cargo_currency" text,
	"stackable" "stackable",
	"dangerous_goods" boolean DEFAULT false NOT NULL,
	"dg_class" text,
	"un_number" text,
	"dg_notes" text,
	"temperature_controlled" boolean DEFAULT false NOT NULL,
	"temp_min_c" numeric(6, 2),
	"temp_max_c" numeric(6, 2),
	"oversized" boolean DEFAULT false NOT NULL,
	"oversized_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"title" text NOT NULL,
	"email_subject" text,
	"account_id" text,
	"contact_id" text,
	"responsible_user_id" text NOT NULL,
	"lead_source" "lead_source" NOT NULL,
	"source_agent_account_id" text,
	"source_note" text,
	"transport_family" "transport_family",
	"incoterms" "incoterms",
	"incoterm_place" text,
	"cargo_ready_date" date,
	"requested_delivery_date" date,
	"special_instructions" text,
	"status" "request_status" DEFAULT 'new' NOT NULL,
	"lost_reason" "lost_reason",
	"lost_reason_note" text,
	"order_id" text,
	"received_at" timestamp with time zone NOT NULL,
	"work_started_at" timestamp with time zone,
	"quotation_started_at" timestamp with time zone,
	"quotation_sent_at" timestamp with time zone,
	"decision_at" timestamp with time zone,
	"order_created_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "requests_number_unique" UNIQUE("number")
);
--> statement-breakpoint
CREATE TABLE "transport_legs" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_type" "shipment_parent" NOT NULL,
	"parent_id" text NOT NULL,
	"leg_number" integer NOT NULL,
	"transport_type" "transport_family" NOT NULL,
	"subtype" "transport_subtype",
	"origin_country" text,
	"origin_city" text,
	"origin_point" text,
	"destination_country" text,
	"destination_city" text,
	"destination_point" text,
	"vehicle_type" "vehicle_type",
	"vehicle_count" integer,
	"container_type" "container_type",
	"container_count" integer,
	"wagon_type" "wagon_type",
	"wagon_count" integer,
	"equipment_description" text,
	"equipment_count" integer,
	"chargeable_weight_kg" numeric(12, 2),
	"volumetric_divisor" integer,
	"routing_preference" "routing_preference",
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_source_agent_account_id_accounts_id_fk" FOREIGN KEY ("source_agent_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cargo_details_parent_idx" ON "cargo_details" USING btree ("parent_type","parent_id");--> statement-breakpoint
CREATE INDEX "requests_account_id_idx" ON "requests" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_responsible_idx" ON "requests" USING btree ("responsible_user_id");--> statement-breakpoint
CREATE INDEX "requests_received_at_idx" ON "requests" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "transport_legs_parent_idx" ON "transport_legs" USING btree ("parent_type","parent_id");