import {pgTable, pgEnum, uuid, text, timestamp, varchar, date, integer, numeric, boolean, jsonb, uniqueIndex, index} from "drizzle-orm/pg-core";

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
export const leaseInvitations = pgTable("lease_invitations", {
 id: uuid("id").primaryKey().defaultRandom(),
 organizationId: uuid("organization_id").notNull().references(() => organizations.id),
 propertyId: uuid("property_id").notNull().references(() => properties.id),
 leaseId: uuid("lease_id").notNull().references(() => leases.id),
 tokenHash: text("token_hash").unique().notNull(),
 expiresAt: timestamp("expires_at", {withTimezone:true}).notNull(),
 revokedAt: timestamp("revoked_at", {withTimezone:true}),
 claimedAt: timestamp("claimed_at", {withTimezone:true}),
 claimedBy: uuid("claimed_by").references(() => users.id),
 approvedAt: timestamp("approved_at", {withTimezone:true}),
 approvedBy: uuid("approved_by").references(() => users.id),
 createdBy: uuid("created_by").notNull().references(() => users.id),
 createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
}, t=>[index("idx_lease_invite_lease").on(t.leaseId),index("idx_lease_invite_expiry").on(t.expiresAt)]);

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
export type InvoiceDocumentSnapshot={
 schemaVersion:1;
 issuerName:string;
 propertyName:string;
 propertyAddress:string;
 roomNumber:string;
 tenantName:string;
};
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
  documentSnapshot: jsonb("document_snapshot").$type<InvoiceDocumentSnapshot|null>(),
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
  ordinal: integer("ordinal").notNull().default(0),
  type: varchar("type", {length:16}).notNull(),
  description: text("description").notNull(),
  unitsMilli: integer("units_milli"),
  tariffSatang: integer("tariff_satang"),
  amountSatang: integer("amount_satang").notNull(),
  snapshot: jsonb("snapshot").notNull()
});
export const paymentInstructions = pgTable("property_payment_instructions", {
 id: uuid("id").primaryKey().defaultRandom(),
 organizationId: uuid("organization_id").notNull().references(() => organizations.id),
 propertyId: uuid("property_id").notNull().references(() => properties.id),
 bankName: varchar("bank_name", {length:120}).notNull(),
 accountName: varchar("account_name", {length:160}).notNull(),
 accountNumber: varchar("account_number", {length:20}).notNull(),
 promptPayId: varchar("promptpay_id", {length:20}),
 active: varchar("active", {length:8}).notNull().default("YES"),
 version: integer("version").notNull().default(1),
 updatedAt: timestamp("updated_at", {withTimezone:true}).notNull().defaultNow(),
 updatedBy: uuid("updated_by").notNull().references(() => users.id)
}, t=>[uniqueIndex("uq_property_payment_instruction").on(t.propertyId)]);

export const paymentClaimStatus = pgEnum("payment_claim_status", ["PENDING","APPROVED","REJECTED"]);
export const paymentClaims = pgTable("payment_claims", {
 id: uuid("id").primaryKey().defaultRandom(),
 organizationId: uuid("organization_id").notNull().references(() => organizations.id),
 propertyId: uuid("property_id").notNull().references(() => properties.id),
 invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
 leaseId: uuid("lease_id").notNull().references(() => leases.id),
 submittedBy: uuid("submitted_by").notNull().references(() => users.id),
 amountSatang: integer("amount_satang").notNull(),
 paidAt: timestamp("paid_at", {withTimezone:true}).notNull(),
 transferReference: varchar("transfer_reference", {length:80}),
 evidenceKey: uuid("evidence_key").notNull().unique(),
 evidenceSha256: varchar("evidence_sha256", {length:64}).notNull(),
 idempotencyKey: varchar("idempotency_key", {length:128}).notNull(),
 status: paymentClaimStatus("status").notNull().default("PENDING"),
 createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow(),
 decidedAt: timestamp("decided_at", {withTimezone:true}),
 decidedBy: uuid("decided_by").references(() => users.id),
 rejectionReason: varchar("rejection_reason", {length:500})
}, t=>[
  index("idx_payment_claim_property_status").on(t.propertyId,t.status),
  index("idx_payment_claim_invoice").on(t.invoiceId),
  uniqueIndex("uq_payment_claim_user_idem").on(t.submittedBy,t.idempotencyKey),
  uniqueIndex("uq_payment_claim_property_transfer").on(t.propertyId,t.transferReference)
]);

export const evidenceUploadStatus = pgEnum("evidence_upload_status",["INITIATED","PROCESSING","READY","CLAIMED","FAILED","EXPIRED"]);
export const evidenceUploads = pgTable("evidence_uploads", {
 id: uuid("id").primaryKey().defaultRandom(),
 organizationId: uuid("organization_id").notNull().references(() => organizations.id),
 propertyId: uuid("property_id").notNull().references(() => properties.id),
 invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
 submittedBy: uuid("submitted_by").notNull().references(() => users.id),
 contentType: varchar("content_type",{length:32}).notNull(),
 contentLength: integer("content_length").notNull(),
 checksumSha256: varchar("checksum_sha256",{length:44}).notNull(),
 status: evidenceUploadStatus("status").notNull().default("INITIATED"),
 evidenceKey: uuid("evidence_key").unique(),
 evidenceSha256: varchar("evidence_sha256",{length:64}),
 expiresAt: timestamp("expires_at",{withTimezone:true}).notNull(),
 createdAt: timestamp("created_at",{withTimezone:true}).notNull().defaultNow(),
 processedAt: timestamp("processed_at",{withTimezone:true}),
 claimedAt: timestamp("claimed_at",{withTimezone:true}),
 legalHold: boolean("legal_hold").notNull().default(false),
 expiredAt: timestamp("expired_at",{withTimezone:true}),
 cleanedAt: timestamp("cleaned_at",{withTimezone:true})
},t=>[
 index("idx_evidence_upload_invoice_user").on(t.invoiceId,t.submittedBy),
 index("idx_evidence_upload_expires").on(t.expiresAt)
]);

export const paymentLedger = pgTable("payment_ledger", {
 id: uuid("id").primaryKey().defaultRandom(),
 organizationId: uuid("organization_id").notNull().references(() => organizations.id),
 propertyId: uuid("property_id").notNull().references(() => properties.id),
 invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
 claimId: uuid("claim_id").notNull().references(() => paymentClaims.id).unique(),
 amountSatang: integer("amount_satang").notNull(),
 createdBy: uuid("created_by").notNull().references(() => users.id),
 createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
},t=>[index("idx_payment_ledger_invoice").on(t.invoiceId)]);

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id").notNull().references(() => users.id),
  organizationId: uuid("organization_id"),
  action: varchar("action", {length:90}).notNull(),
  targetId: uuid("target_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", {withTimezone:true}).notNull().defaultNow()
});
