CREATE TYPE "public"."deposit_entry_kind" AS ENUM('RECEIVED', 'DEDUCTION');--> statement-breakpoint
CREATE TYPE "public"."deposit_review_kind" AS ENUM('DEDUCTION', 'REFUND_REVIEW', 'DISPUTE_REVIEW');--> statement-breakpoint
CREATE TYPE "public"."deposit_review_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint
CREATE TABLE "deposit_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"kind" "deposit_entry_kind" NOT NULL,
	"amount_satang" integer NOT NULL,
	"reference" varchar(128),
	"reason" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"review_id" uuid,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_entries_review_id_unique" UNIQUE("review_id"),
	CONSTRAINT "deposit_entry_positive" CHECK ("deposit_entries"."amount_satang" > 0),
	CONSTRAINT "deposit_entry_source" CHECK (("deposit_entries"."kind" = 'RECEIVED' AND "deposit_entries"."reference" IS NOT NULL AND "deposit_entries"."review_id" IS NULL) OR ("deposit_entries"."kind" = 'DEDUCTION' AND "deposit_entries"."reference" IS NULL AND "deposit_entries"."review_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "deposit_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"lease_id" uuid NOT NULL,
	"kind" "deposit_review_kind" NOT NULL,
	"amount_satang" integer NOT NULL,
	"reason" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"requested_by" uuid NOT NULL,
	"status" "deposit_review_status" DEFAULT 'PENDING' NOT NULL,
	"reviewed_by" uuid,
	"review_reason" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposit_review_positive" CHECK ("deposit_reviews"."amount_satang" > 0),
	CONSTRAINT "deposit_review_distinct_owner" CHECK ("deposit_reviews"."reviewed_by" IS NULL OR "deposit_reviews"."reviewed_by" <> "deposit_reviews"."requested_by")
);
--> statement-breakpoint
ALTER TABLE "deposit_entries" ADD CONSTRAINT "deposit_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_entries" ADD CONSTRAINT "deposit_entries_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_entries" ADD CONSTRAINT "deposit_entries_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_entries" ADD CONSTRAINT "deposit_entries_review_id_deposit_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."deposit_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_entries" ADD CONSTRAINT "deposit_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_reviews" ADD CONSTRAINT "deposit_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_reviews" ADD CONSTRAINT "deposit_reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_reviews" ADD CONSTRAINT "deposit_reviews_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_reviews" ADD CONSTRAINT "deposit_reviews_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposit_reviews" ADD CONSTRAINT "deposit_reviews_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_deposit_entry_lease_key" ON "deposit_entries" USING btree ("lease_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_deposit_receipt_reference" ON "deposit_entries" USING btree ("lease_id","reference");--> statement-breakpoint
CREATE INDEX "idx_deposit_entry_scope" ON "deposit_entries" USING btree ("organization_id","property_id","lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_deposit_review_lease_key" ON "deposit_reviews" USING btree ("lease_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_deposit_review_scope" ON "deposit_reviews" USING btree ("organization_id","property_id","lease_id");--> statement-breakpoint
CREATE FUNCTION "public"."apartment_deposit_entry_immutable"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'DEPOSIT_ENTRY_IMMUTABLE' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "deposit_entries_immutable"
BEFORE UPDATE OR DELETE ON "public"."deposit_entries"
FOR EACH ROW EXECUTE FUNCTION "public"."apartment_deposit_entry_immutable"();
