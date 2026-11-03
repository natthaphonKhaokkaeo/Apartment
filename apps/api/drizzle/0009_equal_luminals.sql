CREATE TYPE "public"."line_outbox_status" AS ENUM('QUEUED', 'SENDING', 'RETRY', 'ACCEPTED', 'SIMULATED', 'DEAD');--> statement-breakpoint
CREATE TABLE "line_notification_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"recipient_line_user_id" varchar(40) NOT NULL,
	"evidence_ref" varchar(500) NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "line_oa_bindings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"bot_user_id" varchar(40) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "line_oa_bindings_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "line_oa_bindings_bot_user_id_unique" UNIQUE("bot_user_id")
);
--> statement-breakpoint
CREATE TABLE "line_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"consent_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"recipient_line_user_id" varchar(40) NOT NULL,
	"event_key" varchar(128) NOT NULL,
	"template_key" varchar(64) NOT NULL,
	"message_text" text NOT NULL,
	"status" "line_outbox_status" DEFAULT 'QUEUED' NOT NULL,
	"retry_key" uuid DEFAULT gen_random_uuid() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"lease_until" timestamp with time zone,
	"provider_request_id" varchar(128),
	"last_error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	CONSTRAINT "line_outbox_retry_key_unique" UNIQUE("retry_key")
);
--> statement-breakpoint
CREATE TABLE "line_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"binding_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"webhook_event_id" varchar(128) NOT NULL,
	"event_type" varchar(64) NOT NULL,
	"redelivery" boolean DEFAULT false NOT NULL,
	"source_user_hash" varchar(64),
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_notification_consents" ADD CONSTRAINT "line_notification_consents_binding_id_line_oa_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."line_oa_bindings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_notification_consents" ADD CONSTRAINT "line_notification_consents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_notification_consents" ADD CONSTRAINT "line_notification_consents_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_oa_bindings" ADD CONSTRAINT "line_oa_bindings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_outbox" ADD CONSTRAINT "line_outbox_binding_id_line_oa_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."line_oa_bindings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_outbox" ADD CONSTRAINT "line_outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_outbox" ADD CONSTRAINT "line_outbox_consent_id_line_notification_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."line_notification_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_outbox" ADD CONSTRAINT "line_outbox_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_binding_id_line_oa_bindings_id_fk" FOREIGN KEY ("binding_id") REFERENCES "public"."line_oa_bindings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_webhook_events" ADD CONSTRAINT "line_webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_consent_lease_binding" ON "line_notification_consents" USING btree ("binding_id","lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_outbox_idempotency" ON "line_outbox" USING btree ("binding_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_line_outbox_dispatch" ON "line_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_webhook_event" ON "line_webhook_events" USING btree ("binding_id","webhook_event_id");--> statement-breakpoint
CREATE INDEX "idx_line_webhook_org" ON "line_webhook_events" USING btree ("organization_id","received_at");