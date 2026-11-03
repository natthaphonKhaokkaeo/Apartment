# Apartment DEV — PostgreSQL Backup and Restore Runbook

Status: 2026-11-03 — Docker volume persistence verified; the first two live logical backups succeeded, with SHA-256, pg_restore metadata validation, and a full restore into an isolated disposable PostgreSQL 16 server. Daily systemd timer is enabled.

## Actual source and location

- Source container: apartment-dev-postgres-1 (postgres:16-alpine), database apartment.
- Docker named volume: apartment-dev_apartment_pg_data; mount at /var/lib/docker/volumes/apartment-dev_apartment_pg_data/_data on the VPS. Never delete with docker compose down -v or docker volume rm.
- The volume keeps data through service restart and ordinary container recreation. It does NOT protect against VPS/disk loss, malicious deletion or corruption.
- Backup files (root-only): /root/backups/apartment-postgres/apartment-YYYYMMDDTHHMMSSZ-PID.dump with .sha256 sidecar. File mode 0600, directory 0700; exclude from Git and public services.
- Script: infra/backup-apartment-postgres.sh. Uses pg_dump custom format and temporary file followed by atomic rename, checksum verification and archive metadata check. Does not modify the production-like DEV source database.

## Automatic schedule (already installed on VPS)

Systemd unit names:
- apartment-postgres-backup.service
- apartment-postgres-backup.timer

Timer: 03:30 every day Asia/Bangkok. Persistent=true catches up when host was off. In repository: infra/systemd/; installed at /etc/systemd/system/ and enabled on the active VPS. Retention: 14 days, only Apartment logical backup files.

Operator checks:

    systemctl status apartment-postgres-backup.timer --no-pager
    systemctl list-timers apartment-postgres-backup.timer --no-pager
    systemctl status apartment-postgres-backup.service --no-pager
    journalctl -u apartment-postgres-backup.service -n 15 --no-pager

Manual commands (run as root from repository):

    ./infra/backup-apartment-postgres.sh backup
    ./infra/backup-apartment-postgres.sh verify
    ./infra/backup-apartment-postgres.sh restore-test

The restore-test creates an ephemeral PostgreSQL container with no network, host ports, persistent storage, or access to the real apartment database. It restores the latest archive there, verifies public tables, and destroys the container afterward. It must never run pg_restore against apartment-dev-postgres-1.

## Recovery procedure / limitations

1. First copy verified backup off this VPS to a protected independent system using encrypted storage and verify checksum there. No offsite destination or credentials have yet been configured.
2. On recovery host, initialize a fresh isolated PostgreSQL 16 instance, inspect archive with pg_restore -l, and restore with pg_restore --exit-on-error --no-owner --no-acl to a NEW EMPTY database.
3. Confirm schema, application access controls, records and invoice/payment data consistency, then change application connection only during a planned recovery. Never overwrite the active original database in-place.
4. Test an offsite restore and define Recovery Point Objective and Recovery Time Objective before Production.

**Remaining gap:** Backups currently share the same VPS/disk. If the VPS, Docker volume and local backup folder are lost together, there is no recoverable copy yet. Offsite replication/alerts and periodic restore drills are required before Production.

Safety: do not store database passwords in this runbook or Git. PostgreSQL persists through reboot via restart=unless-stopped. This procedure only targets Apartment DEV, not other containers.

## Observed DEV verification
- Two backup executions completed successfully with custom pg_dump archives and matching SHA-256 files.
- ./infra/backup-apartment-postgres.sh restore-test restored 25 public tables to an ephemeral postgres:16-alpine instance (network none, no host ports or persistent storage). Source database unchanged.
- systemctl start apartment-postgres-backup.service completed with Result=success and Exit Status=0; apartment-postgres-backup.timer remains active, next run 2026-11-04 03:30 Asia/Bangkok.
- The running Apartment DEV API/Web/Observer and PostgreSQL are healthy after deployment. This verifies local recovery only; offsite disaster recovery still unverified.
