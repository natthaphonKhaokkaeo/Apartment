# P5-02 Maintenance Tickets and Room Status (DEV partial)

## Implemented in source

- Owner/manager can create and list property-scoped tickets, optionally linked to a room. Only owners/managers can read or change ticket details; STAFF and unrelated organizations are denied by property authorization.
- A linked active tenant may open a request only against their own verified lease and may read only tickets they submitted. Tenant requests do not accept a caller-supplied property or room, and the server derives both from the lease.
- Ticket fields include title, description, category, priority, optional due time, reporter type and status. Owner lists show a derived overdue flag. API responses use no-store; list results are bounded to 100.
- Status path: OPEN → ACKNOWLEDGED → IN_PROGRESS → RESOLVED → CLOSED. A RESOLVED ticket may return to IN_PROGRESS. OPEN and ACKNOWLEDGED may be CANCELLED. CLOSED and CANCELLED are terminal. Every actual status change writes an audit event.
- Vacant rooms can enter MAINTENANCE with a reason. A room can return to AVAILABLE only when it has no active lease and all room-linked tickets are CLOSED or CANCELLED. Both actions lock property then room and write audit events.
- Tenant submissions and room maintenance transitions use property → lease/room locking where applicable, aligned with lease close and room occupancy operations.
- Notifications are not sent. LINE maintenance templates remain behind P4 consent/provider acceptance. No attachments are accepted by these endpoints.

## API

- POST /v1/tenant/leases/:leaseId/maintenance-tickets
- GET /v1/tenant/maintenance-tickets
- GET|POST /v1/properties/:propertyId/maintenance-tickets
- PATCH /v1/properties/:propertyId/maintenance-tickets/:ticketId with { "status": "ACKNOWLEDGED" }
- POST /v1/properties/:propertyId/rooms/:roomId/maintenance/enter with a reason
- POST /v1/properties/:propertyId/rooms/:roomId/maintenance/return with { "confirmed": true }

The OWNER console contains ticket creation, status progression, due-time display, and room maintenance entry/return actions. The tenant portal contains lease-bound repair submission and the reporter's request history.

## Verification and open work

- Unit rules cover the allowed/invalid status transitions and overdue calculation. corepack pnpm typecheck and Web production build pass.
- apps/api/scripts/smoke-maintenance.ts covers tenant/owner/outsider scope, ticket lifecycle, and return-from-maintenance guards against real PostgreSQL/HTTP.
- Migration 0016 is generated but NOT applied in the current environment. The PostgreSQL HTTP smoke has not passed; the workspace sandbox prevents its API child from reaching readiness and cannot access the Docker socket.
- Still open: execute migration after verified backup, real PostgreSQL/HTTP smoke, browser interaction QA, private attachment workflow, configurable SLA policy and reports, operational/consent-bound notifications, and independent security/load review. Do not claim P5-02 complete until its runtime and user acceptance gates pass.
