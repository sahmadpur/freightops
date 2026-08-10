CREATE TYPE "public"."message_channel" AS ENUM('email', 'whatsapp', 'phone', 'other');--> statement-breakpoint
CREATE TYPE "public"."message_direction" AS ENUM('incoming', 'outgoing');--> statement-breakpoint
CREATE TABLE "email_attachments" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" text,
	"size_bytes" integer,
	"s3_key" text,
	"document_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_conversations" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"subject" text,
	"mailbox_user_id" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_conversations_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "email_messages" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" text,
	"channel" "message_channel" DEFAULT 'email' NOT NULL,
	"direction" "message_direction" NOT NULL,
	"external_id" text,
	"internet_message_id" text,
	"in_reply_to" text,
	"references_header" text,
	"subject" text,
	"from_name" text,
	"from_email" text,
	"to_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cc_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"body_text" text,
	"sent_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "email_messages_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE "request_emails" (
	"request_id" text NOT NULL,
	"message_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text,
	CONSTRAINT "request_emails_request_id_message_id_pk" PRIMARY KEY("request_id","message_id")
);
--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_attachments" ADD CONSTRAINT "email_attachments_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_conversations" ADD CONSTRAINT "email_conversations_mailbox_user_id_user_id_fk" FOREIGN KEY ("mailbox_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_conversation_id_email_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."email_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_emails" ADD CONSTRAINT "request_emails_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_emails" ADD CONSTRAINT "request_emails_message_id_email_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."email_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "request_emails" ADD CONSTRAINT "request_emails_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_attachments_message_idx" ON "email_attachments" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "email_conversations_mailbox_idx" ON "email_conversations" USING btree ("mailbox_user_id");--> statement-breakpoint
CREATE INDEX "email_messages_conversation_idx" ON "email_messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "email_messages_from_email_idx" ON "email_messages" USING btree ("from_email");--> statement-breakpoint
CREATE INDEX "request_emails_message_idx" ON "request_emails" USING btree ("message_id");