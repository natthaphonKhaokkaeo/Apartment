import {pgTable, pgEnum, uuid, text, timestamp, varchar, date, integer, numeric, jsonb, uniqueIndex, index} from "drizzle-orm/pg-core";

export const roles = pgEnum("membership_role", ["OWNER","MANAGER"]);
export const cadence = pgEnum("billing_cadence", ["MONTHLY","SEMI_MONTHLY","EVERY_15_DAYS"]);
export const roomStatus = pgEnum("room_status", ["AVAILABLE","OCCUPIED","MAINTENANCE"]);
export const meterKind = pgEnum("meter_kind", ["WATER","ELECTRIC"]);
export const invoiceStatus = pgEnum("invoice_status", ["ISSUED","VOID"]);
export const accountStatus = pgEnum("account_status", ["ACTIVE","DISABLED"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  lineSubject: text("line_subject").unique().notNull(),
  displayName: text("display_name").notNull(),
  platformRole: varchar("platform_role", {length: 32}).notNull().default("USER"),
  status: accountStatus("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
});
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id),
  tokenHash: text("token_hash").unique().notNull(),
  expiresAt: timestamp("expires_at", {withTimezone:true}).notNull(),
  revokedAt: timestamp("revoked_at", {withTimezone:true}),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t => [index("idx_session_user").on(t.userId)]);
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  status: accountStatus("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
});
export const memberships = pgTable("memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  role: roles("role").notNull(),
  status: accountStatus("status").notNull().default("ACTIVE")
}, t => [uniqueIndex("uq_member_org_user").on(t.organizationId,t.userId)]);
export const properties = pgTable("properties", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  name: text("name").notNull(),
  address: text("address").notNull().default(""),
  rentSatang: integer("rent_satang").notNull(),
  waterSatangPerUnit: integer("water_satang_per_unit").notNull(),
  electricSatangPerUnit: integer("electric_satang_per_unit").notNull(),
  cadence: cadence("cadence").notNull().default("MONTHLY"),
  rollingAnchor: date("rolling_anchor"),
  dueDays: integer("due_days").notNull().default(7),
  // Only platform compliance review can activate utility invoice issue.
  complianceReviewedAt: timestamp("compliance_reviewed_at", {withTimezone:true}),
  complianceEvidenceRef: text("compliance_evidence_ref"),
  waterAllowedMax: integer("water_allowed_max"),
  electricAllowedMax: integer("electric_allowed_max"),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t=>[index("idx_properties_org").on(t.organizationId)]);
export const rooms = pgTable("rooms", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  number: varchar("number", {length:50}).notNull(),
  floor: integer("floor").notNull().default(1),
  status: roomStatus("status").notNull().default("AVAILABLE"),
  rentOverrideSatang: integer("rent_override_satang"),
  waterOverrideSatang: integer("water_override_satang"),
  electricOverrideSatang: integer("electric_override_satang"),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t => [uniqueIndex("uq_room_number").on(t.propertyId,t.number), index("idx_room_org_prop").on(t.organizationId,t.propertyId)]);
export const leases = pgTable("leases", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  tenantName: text("tenant_name").notNull(),
  tenantLineSubject: text("tenant_line_subject"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: varchar("status", {length:16}).notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t => [index("idx_leases_room").on(t.roomId)]);
export const meterReadings = pgTable("meter_readings", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  kind: meterKind("kind").notNull(),
  readAt: date("read_at").notNull(),
  value: numeric("value", {precision:14,scale:3}).notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t => [uniqueIndex("uq_meter_room_day").on(t.roomId,t.kind,t.readAt)]);
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  propertyId: uuid("property_id").notNull().references(() => properties.id),
  roomId: uuid("room_id").notNull().references(() => rooms.id),
  leaseId: uuid("lease_id").notNull().references(() => leases.id),
  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  dueDate: date("due_date").notNull(),
  amountSatang: integer("amount_satang").notNull(),
  status: invoiceStatus("status").notNull().default("ISSUED"),
  idempotencyKey: varchar("idempotency_key", {length:128}).notNull(),
  issuedBy: uuid("issued_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t => [
  uniqueIndex("uq_invoice_lease_period").on(t.leaseId,t.periodStart,t.periodEnd),
  uniqueIndex("uq_invoice_property_idem").on(t.propertyId,t.idempotencyKey),
  index("idx_invoice_org_property").on(t.organizationId,t.propertyId)
]);
export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
  type: varchar("type", {length:16}).notNull(),
  description: text("description").notNull(),
  unitsMilli: integer("units_milli"),
  tariffSatang: integer("tariff_satang"),
  amountSatang: integer("amount_satang").notNull(),
  snapshot: jsonb("snapshot").notNull()
});
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  organizationId: uuid("organization_id"),
  action: varchar("action", {length:90}).notNull(),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
});
