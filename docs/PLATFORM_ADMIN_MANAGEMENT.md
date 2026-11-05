# Platform Super Admin management

Only an authenticated Super Admin may use these endpoints. The backend resolves the actor from the server session; request bodies cannot nominate the actor or grant themselves authority.

- `GET /v1/admin/platform-users?search=<display name>` returns at most 50 accounts for selection. A user must have completed verified LINE login to appear.
- `PATCH /v1/admin/platform-users/:userId/role` accepts `{ "role": "SUPER_ADMIN" | "USER" }`.

Changes are performed in a database transaction under a PostgreSQL advisory lock, written to the audit log, and revoke all active sessions for the target. The target must sign in again with LINE before the changed role and its Rich Menu take effect. The bootstrap Super Admin, the caller's own account, and the last active Super Admin cannot be demoted. Only active accounts may be changed.

The management UI is in the Super Admin section and is also reachable through the Super Admin LINE Rich Menu at `?section=admin`. Authorization is enforced by the API on every request; hiding the UI is not the security boundary.
