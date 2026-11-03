CREATE TABLE "meter_replacements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"kind" "meter_kind" NOT NULL,
	"replaced_at" date NOT NULL,
	"old_serial" varchar(100) NOT NULL,
	"new_serial" varchar(100) NOT NULL,
	"old_closing_value" numeric(14, 3) NOT NULL,
	"new_opening_value" numeric(14, 3) NOT NULL,
	"evidence_ref" varchar(512) NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meter_replacements" ADD CONSTRAINT "meter_replacements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_replacements" ADD CONSTRAINT "meter_replacements_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_replacements" ADD CONSTRAINT "meter_replacements_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meter_replacements" ADD CONSTRAINT "meter_replacements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_meter_swap_room_kind_day" ON "meter_replacements" USING btree ("room_id","kind","replaced_at");--> statement-breakpoint
CREATE INDEX "idx_meter_swap_period" ON "meter_replacements" USING btree ("organization_id","property_id","room_id","kind","replaced_at");