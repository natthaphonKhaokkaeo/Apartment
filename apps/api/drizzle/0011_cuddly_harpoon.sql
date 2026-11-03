CREATE TABLE "line_dispatch_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"outbox_id" uuid NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "line_ops_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" varchar(64) NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" uuid
);
--> statement-breakpoint
ALTER TABLE "line_dispatch_reservations" ADD CONSTRAINT "line_dispatch_reservations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_dispatch_reservations" ADD CONSTRAINT "line_dispatch_reservations_outbox_id_line_outbox_id_fk" FOREIGN KEY ("outbox_id") REFERENCES "public"."line_outbox"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_ops_alerts" ADD CONSTRAINT "line_ops_alerts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_ops_alerts" ADD CONSTRAINT "line_ops_alerts_acknowledged_by_users_id_fk" FOREIGN KEY ("acknowledged_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_line_dispatch_reservation_window" ON "line_dispatch_reservations" USING btree ("reserved_at","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_line_ops_open_incident" ON "line_ops_alerts" USING btree ("organization_id","kind") WHERE "line_ops_alerts"."resolved_at" is null;--> statement-breakpoint
CREATE INDEX "idx_line_ops_alert_org" ON "line_ops_alerts" USING btree ("organization_id","opened_at");