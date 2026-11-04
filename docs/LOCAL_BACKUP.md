# Approved same-VPS PostgreSQL recovery

User decision: current VPS only. Independent offsite storage is not a DEV acceptance dependency. These copies share /dev/sda1 and cannot survive host/disk loss. No offsite compliance is claimed.

## Runtime

- Source: apartment-dev-postgres-1, database apartment; custom-format consistent pg_dump.
- Source dumps: /root/backups/apartment-postgres, 0700 directory, 0600 files, 14-day default retention.
- Encrypted archives: /root/backups/apartment-local-archive, 0700 directory, age ciphertext + ciphertext SHA-256 + plaintext SHA-256, 0600 files, 30-day default retention.
- Identity: /etc/apartment/backup-age.key, root:root 0600. Never commit, log or paste it in chat.
- Configuration: /etc/apartment/backup.env, root:root 0600. APARTMENT_BACKUP_RETENTION_DAYS (1–3650, systemd backup environment), APARTMENT_ARCHIVE_RETENTION_DAYS (1–3650), APARTMENT_BACKUP_MAX_AGE_HOURS (1–8760), APARTMENT_BACKUP_MAX_DISK_PERCENT (10–99). Explicit environment values override the file.
- The existing 03:30 Asia/Bangkok backup service now archives on successful backup via ExecStartPost. Independent 03:45 archive timer catches failed/partial retries. Hourly health timer checks disk, SHA-256 and freshness measured from dump creation filename, not encryption time.
- Weekly Sunday 05:00 Asia/Bangkok restore timer decrypts to a temporary protected directory and restores to a disposable networkless PostgreSQL 16 container. Original plaintext need not exist. Temporary decrypted material and container are removed on exit.
- flock prevents concurrent dump/archive jobs. Retention never deletes the currently verified archive. No deletion of source archives occurs during recovery.
- OnFailure unit emits BACKUP_ALERT to local syslog/journal. No external email/LINE/paging delivery is enabled. Operator must monitor failed units and journal; external delivery needs an approved destination.

## Commands

Run from /root/Projects/Apartment as root:

    bash infra/backup-apartment-postgres.sh backup
    bash infra/local-archive-apartment-postgres.sh archive
    bash infra/local-archive-apartment-postgres.sh check
    bash infra/local-archive-apartment-postgres.sh restore-test
    bash infra/rehearse-apartment-migration-rollback.sh
    bash infra/tests/local-archive-integration.test.sh
    systemctl list-timers 'apartment-*' --no-pager
    systemctl --failed --no-pager
    journalctl -t apartment-backup --no-pager

Migration 0017 upgrade rehearsal chooses the newest checksum-valid pre-0017 archive; current backups already contain 0017 and must not have the migration reapplied. The rehearsal uses only networkless disposable storage. If no pre-0017 backup is retained, it fails explicitly instead of claiming an upgrade test passed. Current-schema encrypted restore remains independently tested.

## Recovery key custody

The key was generated on the VPS without logging its contents. The operator should use an authenticated SSH/SFTP session to copy /etc/apartment/backup-age.key directly to a protected password-manager attachment or encrypted operator-controlled medium, verify permissions 0600, and confirm a recovery drill. Do not transmit it through chat, source control or logs. Operator custody has not been confirmed. Losing both this VPS and the key makes these local archives unrecoverable.

## Recovery

1. Preserve all available ciphertext, both checksum sidecars and the recovery identity. Verify ciphertext SHA-256.
2. Run restore-test first. It decrypts only into temporary protected storage, validates plaintext SHA-256 and restores a NEW disposable database.
3. Inspect restored schema, financial invariants and application compatibility before proposing a cutover.
4. Restoring over live PostgreSQL or changing the live DB connection requires separate explicit approval. No script here restores to the live database.

## Verified acceptance

Fresh same-VPS run: custom dump 126239 bytes, SHA-256 PASS, authenticated age encryption/decryption PASS, encrypted-only restore of 32 public tables PASS, retention deletion of only an owned expired fixture PASS, current verified archive preserved, modified ciphertext rejected, disk threshold rejected, concurrent archive lock rejected. Isolated pre-0017 upgrade and backup recovery fingerprints PASS. Local OnFailure alert was exercised and recorded in journal. See master status for subsequent command results.

Residual risk: same-host/disk copies are not independent disaster recovery. No independent host-loss, legal, bank or real LINE provider acceptance is implied.
