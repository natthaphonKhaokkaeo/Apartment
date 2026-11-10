# Apartment PostgreSQL — encrypted offsite backup (P0)

> **Cloudflare R2 implementation (2026-11-10):** see [CLOUDFLARE_R2_BACKUP_SETUP.md](CLOUDFLARE_R2_BACKUP_SETUP.md). Added interactive bucket-scoped R2 provisioning, a root-owned config guard, and real encrypted local-provider roundtrip with isolated PostgreSQL restore. Live R2 credentials, external recovery acceptance and timer activation remain **pending operator setup**. The existing local backup system is unchanged.


> Current approved DEV design: encrypted same-VPS archive, not offsite. See [LOCAL_BACKUP.md](LOCAL_BACKUP.md). Independent offsite setup below is optional future host-loss protection and is not required for approved DEV local backup acceptance.


**Status: code implemented; actual offsite upload and recovery NOT yet accepted.** The feature remains intentionally fail-closed without operator-provided destination and recovery configuration; `age` and `rclone` prerequisites were installed on the VPS on 2026-11-04. The workflow never changes the running PostgreSQL database.

## Required setup (operator later)

Install age and rclone on the Apartment VPS. Configure an isolated root-owned rclone remote dedicated to the Apartment backup prefix, with minimum permissions and remote immutability/object lock if available. Generate an age X25519 private identity on a separate approved recovery machine; keep it in a recovery-only secret store. Share **only its age1 public recipient** with the uploader. Never store the private identity or rclone credentials in the repository.

| Variable | Meaning |
| --- | --- |
| APARTMENT_OFFSITE_AGE_RECIPIENT | Public age recipient, age1 plus 58 lowercase characters |
| APARTMENT_OFFSITE_REMOTE | A dedicated rclone destination, e.g. apartmentoffsite:postgres/DEV |
| APARTMENT_OFFSITE_AGE_IDENTITY | Absolute path to private age key on an isolated recovery machine only (file mode 0400/0600) |

## Upload workflow

After running the existing local backup and verify actions, execute as root:

    ./infra/backup-apartment-postgres.sh backup
    ./infra/backup-apartment-postgres.sh verify
    ./infra/offsite-apartment-postgres.sh check
    ./infra/offsite-apartment-postgres.sh upload

Preflight validates the exact protected archive, its SHA-256 checksum, executable prerequisites and public destination. Upload encrypts that archive with age first, then sends only the ciphertext using immutable rclone copyto, and checks a streamed remote readback against the local encrypted SHA-256. Temporary ciphertext file has private permissions and is removed on exit. The script fails closed on upload or checksum errors. Only archive filename/timestamp metadata is visible remotely. Do not schedule automatic uploads before operator approval.

## Retrieval workflow on a separate recovery machine

Set the rclone destination and private identity path on the recovery machine; the private key does not need to exist on the Apartment VPS. Prepare an empty protected /root/backups/apartment-postgres directory. Execute:

    ./infra/retrieve-offsite-apartment-postgres.sh apartment-YYYYMMDDTHHMMSSZ-PID.dump

The script rejects malformed filenames, invalid remote paths, insecure key permissions, and existing archive names. It streams remote encrypted ciphertext through authenticated age decryption to a restrictive temporary file, validates PostgreSQL custom archive structure inside a networkless disposable Docker container, installs the verified dump, and writes a checksum sidecar. It **never restores into a live database**. Separately run the existing isolated restore-test and explicitly plan any live recovery after business-level reconciliation.

## Optional scheduled shipping (install only after offsite credentials and an approved recovery drill)

The repository contains `infra/systemd/apartment-postgres-offsite.service` and `.timer`, scheduled for 04:30 Asia/Bangkok (with up to 15 minutes randomized delay), after the existing 03:30 local backup timer. The service skips execution unless the root-only `/etc/apartment/offsite.env` file exists, runs a validated checksum preflight before shipping, and uses systemd restrictions. Operator must review unit paths, ensure the age public recipient, rclone destination and restricted rclone configuration are available to root, then explicitly enable the timer. **The timer has not been installed or enabled on VPS.** `systemd-analyze calendar` and `systemd-analyze verify` validated its syntax only.

## Local offline upload flow regression

`infra/tests/offsite-upload-mock.test.sh` verifies the uploader using a **test-only fake** age command and a local fake rclone remote. It checks that the upload receives ciphertext-formatted test output, that an existing immutable object is never overwritten, that corrupted remote readback is rejected, and that simulated encryption or upload failures stop the process without uploading unencrypted data. It performs no external transfer and uses the existing verified local backup only as a read-only input; mock age does **not** provide cryptographic encryption, so this test does not replace a real age/rclone interoperability drill. The script is deliberately local-VPS/root-only; CI parses its shell syntax without requiring actual backup archives.

## 2026-11-05 real local cryptography rehearsal

After installing real `age` and `rclone`, tested the existing checksum-verified Apartment backup with an ephemeral age keypair and temporary, root-only **local** rclone alias. The uploader reported `OFFSITE_UPLOAD_PASS`; a separate streaming `rclone cat | age -d -i <ephemeral-key> | sha256sum` matched the original backup SHA-256. All temporary ciphertext, key material, and local remote contents were deleted on completion. This proves real age/rclone interoperability and ciphertext hash integrity without transmitting plaintext or touching the live database. **It is not an independent offsite upload/recovery drill** and does not prove remote IAM, retention/object lock, outage resilience or RPO/RTO. External remote credentials and separately held private key are still required before scheduling.

## Acceptance constraints

Locally verified shell checks: bash syntax and infra/tests/offsite-apartment-postgres.test.sh, which tests eight failure/preflight paths without external uploads (stub executables used). This is not evidence of a real offsite upload, authenticated decryption of a real backup, cloud IAM correctness, retention, immutable object storage, or disaster recovery RPO/RTO. On 2026-11-04, Ubuntu packages `age` 1.1.1 and `rclone` 1.60.1 were installed successfully without service restarts. Offline fake-provider upload regression returned `OFFSITE_UPLOAD_MOCK_PASS` (encryption-first, immutable, corruption rejection and fail-closed errors). `/etc/apartment/offsite.env` and an approved remote destination are still missing; the offsite timer remains inactive. No real offsite recovery or RPO/RTO acceptance has been performed. Complete a supervised encrypted upload and remote-machine restore drill after provisioning. Keep original backups and encryption keys separately secured.
