# ApartMe PostgreSQL — Cloudflare R2 offsite backup

**Implementation state:** prepared and offline recovery tested. **Cloudflare connection not yet configured:** the operator must create the private R2 bucket, scoped S3 access keys and a separately held age recovery key. Until an authenticated R2 roundtrip has been verified from a separate recovery machine, keep the offsite timer **disabled**. No database writes, R2 requests, or actual external backups occur during preparatory installation and offline tests.

## Existing foundation (preserved)

- PostgreSQL custom-format daily backup at **03:30 Asia/Bangkok**, original dump with SHA-256, retained on VPS for 14 days (by default).
- Separate same-VPS `age` encrypted archives retained for 30 days, and weekly isolated PostgreSQL restore drill on Sunday 05:00.
- These local copies share a failure domain with the primary server and are not independent disaster recovery.
- Offsite pipeline: `infra/offsite-apartment-postgres.sh upload`, **re-encrypts** a checksum-validated local dump using a separate age public recipient; uploads only the encrypted object to R2 using `rclone copyto --immutable`, then streams ciphertext back and checks SHA-256. The root-owned temp ciphertext is removed on exit. Does not modify the database.
- No application API token, tenant password or LINE OA credential is needed for the offsite backup.

## 1. Provision a PRIVATE Cloudflare R2 bucket — operator task

1. In Cloudflare Dashboard go to **Storage & databases → R2 Object Storage → Overview → Create bucket**.
2. Create a dedicated private bucket, e.g. `apartme-db-backups`. Use a distinct bucket from customer files; do not publish `r2.dev` access or map a public domain to it.
3. Choose standard/default jurisdiction unless there is a compliance requirement; note jurisdiction (`global`, `eu`, `us`, `fedramp`). The endpoint for global is `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; EU/US/FedRAMP use jurisdiction-specific subdomains.
4. Under **Manage R2 API Tokens**, create a bucket-scoped **Object Read & Write** token for this bucket only. Avoid Account Admin permissions. Save **Access Key ID** and **Secret Access Key** in a trusted secret manager, not GitHub, chat, screenshots, or the application database. The uploader needs reads for post-upload integrity verification. This token may have object delete permission, so enable an R2 **Bucket Lock** rule on prefix `postgres/dev/` for at least **30 days** (recommend 90 days where retention allows) to protect against accidental deletion/ransomware. A practical DEV starting policy is a **30-day Bucket Lock** for `postgres/dev/` plus an R2 **Lifecycle expiration after 180 days** for the same prefix (adjust for data-retention/legal requirements). If configuring Lifecycle automatic deletion, set the minimum lifetime *longer than* the lock period. Do not configure a rule deleting the newest copy within the recovery window.
5. Record the 32-character Cloudflare Account ID and the dedicated bucket name. This repository does **not** automatically alter bucket policy or lifecycle; an operator must configure and verify them in Cloudflare's UI.

Official setup: https://developers.cloudflare.com/r2/get-started/s3/ ; bucket-lock details: https://developers.cloudflare.com/r2/buckets/bucket-locks/ .

## 2. Generate a separate **offsite** recovery identity — operator task on another machine

**Never run this on the ApartMe VPS for the real production recovery key.** On a separate encrypted and access-controlled recovery host:

```sh
umask 077
age-keygen -o apartme-r2-recovery.key
age-keygen -y apartme-r2-recovery.key
```

Keep the private `apartme-r2-recovery.key` in two appropriately protected, independent recovery locations; keep it off the ApartMe server and R2. Copy **only the `age1...` PUBLIC recipient** to the VPS when prompted. Losing this private key means the remote ciphertext cannot be decrypted. Rotating the key requires maintaining older recovery keys for historical backups.

## 3. Configure R2 on the VPS (interactive; does NOT enable scheduling)

In an **SSH terminal** on the VPS, in `/root/Projects/Apartment`:

```sh
sudo bash infra/setup-apartment-r2.sh configure
sudo bash infra/setup-apartment-r2.sh status
sudo bash infra/setup-apartment-r2.sh remote-check
```

Prompts: account ID, dedicated bucket name, jurisdiction, scoped R2 Access Key ID, **hidden** Secret Access Key, and separate **age PUBLIC recipient**. The script refuses noninteractive secret input; does not place secrets on command lines or in Git; validates the credentials by listing the intended R2 bucket before installing any files. It writes root-only `0600` configuration under:

- `/etc/apartment/r2/rclone.conf`: one dedicated `apartmentr2` remote with S3-compatible Cloudflare endpoint, object-level `no_check_bucket=true`, bucket-scoped credentials.
- `/etc/apartment/offsite.env`: `RCLONE_CONFIG`, `APARTMENT_OFFSITE_REMOTE=apartmentr2:<bucket>/postgres/dev` and the **public** age recipient.

Both paths are inside root-owned `0700` directories. Do not share file contents. An existing configuration is never silently overwritten: perform deliberate key rotation with a protected backup of recovery metadata. Any failure leaves scheduling disabled.

## 4. Verify live encrypted upload, readback and recovery before enabling timer

With the R2 configuration ready:

```sh
cd /root/Projects/Apartment
sudo bash infra/backup-apartment-postgres.sh verify
sudo bash infra/setup-apartment-r2.sh remote-check
sudo systemctl start apartment-postgres-offsite.service
sudo systemctl show apartment-postgres-offsite.service -p Result -p ExecMainStatus
sudo journalctl -u apartment-postgres-offsite.service -n 60 --no-pager
```

Expect `OFFSITE_UPLOAD_PASS encrypted=true remote_ciphertext_verified=true plaintext_uploaded=false` and a new private `postgres/dev/apartment-*.dump.age` object on R2. The uploader is deliberately immutable: rerunning against the identical name may report an existing object rather than replacing it. Do not delete known-good historical objects just to retry a test.

**Recovery drill on a SEPARATE recovery host** with Docker, rclone, age and the private key:

1. Configure a read-only bucket-scoped rclone remote if possible, with remote name/path matching `APARTMENT_OFFSITE_REMOTE`. Use the same Cloudflare endpoint and prefix. Keep its credentials root-only.
2. Copy the repository's `infra/retrieve-offsite-apartment-postgres.sh` and `infra/restore-offsite-apartment-postgres.sh` to the recovery host. Set `APARTMENT_OFFSITE_REMOTE` and `APARTMENT_OFFSITE_AGE_IDENTITY=/path/to/secure/apartme-r2-recovery.key` (mode 0600, root owned).
3. Prepare a fresh root-owned `/root/backups/apartment-postgres` directory (0700) **on the recovery host only**, choose the exact remote filename, and execute `./infra/retrieve-offsite-apartment-postgres.sh apartment-YYYYMMDDTHHMMSSZ-PID.dump` as root with controlled environment variables.
4. This retrieves, authenticates/decrypts and validates the pg_dump archive without touching a database. Then run `bash infra/restore-offsite-apartment-postgres.sh apartment-YYYYMMDDTHHMMSSZ-PID.dump` **on that separate recovery host**. It does not need access to the original ApartMe database container. It uses `docker run --network none` and a temporary PostgreSQL 16 instance. Do not restore into production.
5. Check the table count, schema and application-specific sanity checks. Store evidence of recovery date, object, duration, and outcome in the restricted operations log; never paste private keys/contents. A Cloudflare-side successful upload alone is insufficient for recovery acceptance.

## 5. Enable daily shipping *only after* live recovery acceptance

The following checked-in systemd units are installed but intentionally disabled until recovery acceptance:

- `apartment-postgres-offsite.service`: verifies the scoped Cloudflare R2 configuration and latest local checksum, then sends ciphertext. OnFailure alerts to local syslog/journal.
- `apartment-postgres-offsite.timer`: daily **04:30 Asia/Bangkok** with up to 15 minutes randomized delay, following the 03:30 local backup.

After steps 1–4 PASS:

```sh
sudo systemctl enable --now apartment-postgres-offsite.timer
sudo systemctl list-timers apartment-postgres-offsite.timer --all
sudo systemctl status apartment-postgres-offsite.timer --no-pager
```

For security monitoring, inspect `journalctl -u apartment-postgres-offsite.service -n 50 --no-pager` and `journalctl -t apartment-backup --no-pager`. Configure external alert delivery later; local syslog by itself does not notify an operator remotely. R2 Lifecycle and Bucket Lock settings are external Cloudflare controls and are not created by these scripts.

## 6. Offline acceptance (safe to run now; Cloudflare account not needed)

```sh
sudo bash infra/tests/r2-setup-config.test.sh
sudo bash infra/tests/offsite-apartment-postgres.test.sh
sudo bash infra/tests/offsite-upload-mock.test.sh
sudo bash infra/tests/r2-encrypted-roundtrip.test.sh
sudo bash infra/tests/r2-restore-guards.test.sh
```

The roundtrip uses **real `age` encryption and rclone**, a local-only mock remote, a throwaway test-only private identity, SHA-256 readback, and actual PostgreSQL restoration into a disposable **networkless** container. It never sends data to Cloudflare, never writes to the live database, and cleans up the temporary recovery identity/archive. It proves the mechanics but *cannot* prove R2 bucket IAM, public access status, bucket lock enforcement, geographic independence, or a recovery host's key availability.

## Operations and limitations

- Frequency: daily encrypted database full snapshots; worst-case database RPO is approximately 24 hours, *after* the scheduled upload is active and successful. Verify RTO by actual external recovery drill rather than assuming one.
- Backup contents: PostgreSQL database only. Uploaded payment attachments, file evidence and any filesystem volumes not stored in PostgreSQL require a **separate** object-storage backup policy. The database and related files should have consistent retention points.
- Cloudflare Bucket Lock / Lifecycle must be explicitly configured in Cloudflare's dashboard; do not delegate R2 bucket-admin privileges to the VPS just to manage retention.
- Restore onto a *different* approved machine; keep recovery-only private key separate. If the VPS is compromised, immediately revoke/rotate the R2 uploader token and verify history under Bucket Lock.
- PostgreSQL point-in-time recovery (WAL streaming) is not part of this first-phase full-snapshot feature.
