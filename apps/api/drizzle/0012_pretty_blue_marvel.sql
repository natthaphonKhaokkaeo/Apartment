CREATE TABLE "property_rate_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"property_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"rent_satang" integer NOT NULL,
	"water_satang_per_unit" integer NOT NULL,
	"electric_satang_per_unit" integer NOT NULL,
	"reason" varchar(500) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "property_rate_versions" ADD CONSTRAINT "property_rate_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rate_versions" ADD CONSTRAINT "property_rate_versions_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_rate_versions" ADD CONSTRAINT "property_rate_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_property_rate_effective_date" ON "property_rate_versions" USING btree ("property_id","effective_from");--> statement-breakpoint
CREATE INDEX "idx_property_rates_org" ON "property_rate_versions" USING btree ("organization_id","property_id","effective_from");--> statement-breakpoint
-- Existing masters receive an immutable-as-of-current-baseline marker.
-- This does not rewrite any previously issued invoice snapshot.
INSERT INTO property_rate_versions
 (organization_id,property_id,effective_from,rent_satang,
  water_satang_per_unit,electric_satang_per_unit,reason)
SELECT p.organization_id,p.id,DATE '1900-01-01',p.rent_satang,
 p.water_satang_per_unit,p.electric_satang_per_unit,'MIGRATED_BASELINE'
FROM properties p
WHERE NOT EXISTS(SELECT 1 FROM property_rate_versions v WHERE v.property_id=p.id);
--> statement-breakpoint
CREATE FUNCTION apartment_seed_property_rate_baseline() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO property_rate_versions
  (organization_id,property_id,effective_from,rent_satang,
   water_satang_per_unit,electric_satang_per_unit,reason)
 VALUES(NEW.organization_id,NEW.id,DATE '1900-01-01',NEW.rent_satang,
  NEW.water_satang_per_unit,NEW.electric_satang_per_unit,'INITIAL_BASELINE');
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER tr_apartment_seed_property_rate
AFTER INSERT ON properties
FOR EACH ROW EXECUTE FUNCTION apartment_seed_property_rate_baseline();
