CREATE TABLE "room_rate_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"room_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"rent_override_satang" integer,
	"water_override_satang" integer,
	"electric_override_satang" integer,
	"reason" varchar(500) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "room_rate_versions" ADD CONSTRAINT "room_rate_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_rate_versions" ADD CONSTRAINT "room_rate_versions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_rate_versions" ADD CONSTRAINT "room_rate_versions_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "room_rate_versions" ADD CONSTRAINT "room_rate_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_room_rate_effective_date" ON "room_rate_versions" USING btree ("room_id","effective_from");--> statement-breakpoint
CREATE INDEX "idx_room_rates_scope" ON "room_rate_versions" USING btree ("organization_id","property_id","room_id","effective_from");
--> statement-breakpoint
INSERT INTO room_rate_versions
 (organization_id,property_id,room_id,effective_from,rent_override_satang,water_override_satang,electric_override_satang,reason)
SELECT organization_id,property_id,id,DATE '1900-01-01',rent_override_satang,water_override_satang,electric_override_satang,'MIGRATED_BASELINE'
FROM rooms;

--> statement-breakpoint
CREATE FUNCTION apartment_seed_room_rate_baseline() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO room_rate_versions
  (organization_id,property_id,room_id,effective_from,
   rent_override_satang,water_override_satang,electric_override_satang,reason)
 VALUES(NEW.organization_id,NEW.property_id,NEW.id,DATE '1900-01-01',
  NEW.rent_override_satang,NEW.water_override_satang,
  NEW.electric_override_satang,'INITIAL_BASELINE');
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER tr_apartment_seed_room_rate
AFTER INSERT ON rooms
FOR EACH ROW EXECUTE FUNCTION apartment_seed_room_rate_baseline();
