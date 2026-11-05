CREATE TYPE "public"."billing_batch_status" AS ENUM('PREVIEWED', 'COMPLETED', 'STALE');--> statement-breakpoint
CREATE TABLE "billing_batch_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"preview_hash" varchar(64) NOT NULL,
	"preview_snapshot" jsonb NOT NULL,
	"status" "billing_batch_status" DEFAULT 'PREVIEWED' NOT NULL,
	"created_by" uuid NOT NULL,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"issued_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "billing_batch_run_id" uuid;--> statement-breakpoint
ALTER TABLE "billing_batch_runs" ADD CONSTRAINT "billing_batch_runs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_batch_runs" ADD CONSTRAINT "billing_batch_runs_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_batch_runs" ADD CONSTRAINT "billing_batch_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_batch_runs" ADD CONSTRAINT "billing_batch_runs_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_billing_batch_property_idem" ON "billing_batch_runs" USING btree ("property_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_billing_batch_property_created" ON "billing_batch_runs" USING btree ("property_id","created_at");--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_billing_batch_run_id_billing_batch_runs_id_fk" FOREIGN KEY ("billing_batch_run_id") REFERENCES "public"."billing_batch_runs"("id") ON DELETE no action ON UPDATE no action;