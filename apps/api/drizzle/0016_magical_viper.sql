CREATE TYPE "public"."maintenance_ticket_category" AS ENUM('PLUMBING', 'ELECTRICAL', 'APPLIANCE', 'STRUCTURE', 'CLEANING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."maintenance_ticket_priority" AS ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."maintenance_ticket_status" AS ENUM('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "maintenance_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid,
	"lease_id" uuid,
	"reported_by_user_id" uuid NOT NULL,
	"reporter_type" varchar(12) NOT NULL,
	"title" varchar(160) NOT NULL,
	"description" text NOT NULL,
	"category" "maintenance_ticket_category" NOT NULL,
	"priority" "maintenance_ticket_priority" DEFAULT 'NORMAL' NOT NULL,
	"status" "maintenance_ticket_status" DEFAULT 'OPEN' NOT NULL,
	"due_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "maintenance_tickets" ADD CONSTRAINT "maintenance_tickets_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_maintenance_property_status" ON "maintenance_tickets" USING btree ("organization_id","property_id","status","created_at");--> statement-breakpoint
CREATE INDEX "idx_maintenance_reporter" ON "maintenance_tickets" USING btree ("reported_by_user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_maintenance_due" ON "maintenance_tickets" USING btree ("due_at","status");