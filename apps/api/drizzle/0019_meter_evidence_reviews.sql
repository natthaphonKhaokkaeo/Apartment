CREATE TABLE "meter_anomaly_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"reading_id" uuid NOT NULL,
	"action" varchar(32) NOT NULL,
	"reason" text NOT NULL,
	"assessment" jsonb NOT NULL,
	"max_daily_milli" numeric(14, 0) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meter_review_action" CHECK ("meter_anomaly_reviews"."action" IN ('ACKNOWLEDGED','REQUIRES_CORRECTION')),
	CONSTRAINT "meter_review_threshold" CHECK ("meter_anomaly_reviews"."max_daily_milli" > 0 AND "meter_anomaly_reviews"."max_daily_milli" <= 99999999999999)
);
--> statement-breakpoint
CREATE TABLE "meter_reading_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"reading_id" uuid NOT NULL,
	"evidence_key" uuid NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"size_bytes" integer NOT NULL,
	"scan_verdict" varchar(24) NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meter_reading_evidence_evidence_key_unique" UNIQUE("evidence_key"),
	CONSTRAINT "meter_evidence_size" CHECK ("meter_reading_evidence"."size_bytes" > 0 AND "meter_reading_evidence"."size_bytes" <= 4194304),
	CONSTRAINT "meter_evidence_scan_verdict" CHECK ("meter_reading_evidence"."scan_verdict" IN ('CLEAN','NOT_SCANNED_DEV'))
);
--> statement-breakpoint
ALTER TABLE "meter_anomaly_reviews" ADD CONSTRAINT "meter_anomaly_reviews_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_anomaly_reviews" ADD CONSTRAINT "meter_anomaly_reviews_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_anomaly_reviews" ADD CONSTRAINT "meter_anomaly_reviews_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_anomaly_reviews" ADD CONSTRAINT "meter_anomaly_reviews_reading_id_meter_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."meter_readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_anomaly_reviews" ADD CONSTRAINT "meter_anomaly_reviews_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_reading_evidence" ADD CONSTRAINT "meter_reading_evidence_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_reading_evidence" ADD CONSTRAINT "meter_reading_evidence_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_reading_evidence" ADD CONSTRAINT "meter_reading_evidence_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_reading_evidence" ADD CONSTRAINT "meter_reading_evidence_reading_id_meter_readings_id_fk" FOREIGN KEY ("reading_id") REFERENCES "public"."meter_readings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_reading_evidence" ADD CONSTRAINT "meter_reading_evidence_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meter_review_reading_key" ON "meter_anomaly_reviews" USING btree ("reading_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_meter_review_scope" ON "meter_anomaly_reviews" USING btree ("organization_id","property_id","room_id","reading_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meter_evidence_reading_key" ON "meter_reading_evidence" USING btree ("reading_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "idx_meter_evidence_scope" ON "meter_reading_evidence" USING btree ("organization_id","property_id","room_id","reading_id");