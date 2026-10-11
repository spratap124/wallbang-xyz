# WallBang MongoDB Backup Utility

Portable, provider-agnostic backup utility for the WallBang MongoDB Atlas
cluster. Dumps to timestamped compressed archives, validates them, encrypts
them client-side with an rclone `crypt` remote, and uploads them to a private
Backblaze B2 bucket.

It is intentionally **independent of the website**:

- No dependency on Docker, the Next.js app, or application environment files.
- Atlas and Backblaze B2 stay external, so moving to a new VPS never migrates
  backup history and never requires rebuilding the backup infrastructure.
- Everything lives in this directory plus `/etc/wallbang-backup/` and
  `/var/backups/wallbang-mongodb/`.

```
infra/mongodb-backup/
├── bin/backup.sh          # daily dump -> validate -> encrypt -> upload -> prune
├── bin/restore.sh         # manual, confirmed restore into any target URI
├── bin/verify-backup.sh   # local + remote verification
├── lib/common.sh          # shared helpers (config, logging, locking, redaction)
├── config/backup.env.example
├── systemd/*.service|timer
├── logrotate/wallbang-backup
├── install.sh             # idempotent installer
├── tests/                 # dependency-free tests (no root, no network)
└── README.md
```

## What it does

1. Acquires a lock (`flock` when available) so runs never overlap.
2. Checks prerequisites, free disk space, and remote reachability.
3. `mongodump --gzip --archive` into `mongodb-YYYYmmdd-HHMMSS/` using a `0600`
   options file, so the connection string never appears in `ps`.
4. Validates the archive with `mongorestore --dryRun`, then writes a
   `.sha256` sidecar.
5. Uploads the encrypted archive + checksum to B2 and verifies the remote size
   (optionally downloads and byte-compares).
6. Prunes local and remote backups older than `RETENTION_DAYS` — **only after**
   the new backup is uploaded and verified.
7. Logs to the journal and a log file; optionally notifies Discord on failure.

Schedule: daily at **02:00 Asia/Kolkata** via `wallbang-mongodb-backup.timer`.

## Prerequisites

- Ubuntu 22.04/24.04 VPS, `root`/`sudo`.
- MongoDB Atlas cluster reachable over the public internet.
- Backblaze B2 bucket (created outside this repo) + application key.
- MongoDB Database Tools (`mongodump`, `mongorestore`) and `rclone`
  (installed by `install.sh`).

## Configuration values you must supply

| Value | Where | Notes |
| --- | --- | --- |
| `MONGODB_URI` | `/etc/wallbang-backup/backup.env` | Dedicated Atlas user with `readAnyDatabase` only. Quote it. |
| `MONGODB_DATABASES` | same | Optional space-separated list; empty = every readable database. |
| `RCLONE_CRYPT_REMOTE` | same | Name of the rclone **crypt** remote (e.g. `wallbang-backup-crypt`). |
| `RCLONE_PATH` | same | Folder inside the remote (default `mongodb`). |
| `RETENTION_DAYS` | same | Default `30`. |
| `DISCORD_WEBHOOK_URL` | same | Optional failure notifications. |
| `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET`, `CRYPT_PASSWORD`, `CRYPT_SALT` | `backup.env` (consumed once by `wallbang-backup-setup`) | Optional scripted setup; never in this repo. |
| B2 key ID/secret | rclone config (`/etc/wallbang-backup/rclone.conf`) | Written by the setup script. |
| `RCLONE_CONFIG` / `RCLONE_CACHE_DIR` | config file | `/etc/wallbang-backup/rclone.conf`, `/var/cache/wallbang-backup`. |
| crypt password + salt | rclone config | **Escrow these** (see Secrets below). |
| rclone config password | `/etc/wallbang-backup/rclone-pass` (0600) | Only if `rclone.conf` is encrypted. |

### B2 bucket and key (manual, one-off)

1. Backblaze → **B2 Cloud Storage → Buckets → Create Bucket**.
   - Name: `wallbang-db-backups`
   - Private (do **not** enable public access)
   - Optional: enable **Object Lock** if you need ransomware protection.
2. **Application Keys → Add a New Application Key**.
   - Restrict to the single bucket `wallbang-db-backups`.
   - Capabilities: `Read and Write` (list files, read/write/delete).
   - Copy the key ID + secret immediately; they are shown once.
3. Lifecycle: rclone deletes objects older than the retention window, which on
   B2 creates *hide* markers by default. To keep the bucket tidy, either
   add a lifecycle rule that hides old versions/deletes hidden files after a
   few days, or set `--b2-hard-delete` for the delete step.

## First-time installation

```bash
# 1. Get the repository onto the VPS (any directory; /opt is convenient)
sudo git clone git@github.com:spratap124/wallbang-xyz.git /opt/wallbang-src
cd /opt/wallbang-src/infra/mongodb-backup

# 2. Install (installs tools, creates dirs, installs units; idempotent)
sudo ./install.sh
```

Then configure:

```bash
# 3. MongoDB Atlas: create a backup-only database user (Atlas UI) and put the
#    SRV string into the config file.
sudo nano /etc/wallbang-backup/backup.env      # set MONGODB_URI, RCLONE_* …

# 4. Backblaze B2 + rclone crypt remote — scripted from backup.env
#    Put the values in the config file and let the utility build the remotes
#    (it obscures the crypt password/salt and never prints them):
sudo nano /etc/wallbang-backup/backup.env
#   B2_KEY_ID='<Backblaze keyID>'
#   B2_APPLICATION_KEY='<Backblaze applicationKey (secret)>'
#   B2_BUCKET='wallbang-db-backups'
#   RCLONE_CRYPT_REMOTE='wallbang-backup-crypt'
#   CRYPT_PASSWORD='<a long random string you save in your password manager>'
#   CRYPT_SALT='<another long random string you save>'
sudo wallbang-backup-setup          # creates wallbang-b2 + the crypt remote, then verifies

# Prefer doing it by hand? The systemd unit runs under ProtectHome=true, so
# rclone must NOT read /root/.config — keep its config under /etc:
#   sudo rclone --config /etc/wallbang-backup/rclone.conf config create ...

# 5. (Recommended) Encrypt rclone.conf and load its password from a root-only file
rclone --config /etc/wallbang-backup/rclone.conf config password
install -m 0600 /dev/null /etc/wallbang-backup/rclone-pass
printf '%s' '<CONFIG_PASSWORD>' > /etc/wallbang-backup/rclone-pass
#    then set RCLONE_CONFIG_PASS_COMMAND='/usr/bin/cat /etc/wallbang-backup/rclone-pass'
sudo nano /etc/wallbang-backup/backup.env
```

Validate, back up once, then enable the schedule:

```bash
# 6. Validate without dumping and confirm the remote is reachable
sudo wallbang-backup-verify --remote

# 7. Manual backup + verification
sudo wallbang-backup
sudo wallbang-backup-verify --latest --remote

# 8. Enable the daily 02:00 IST timer
sudo systemctl enable --now wallbang-mongodb-backup.timer
systemctl list-timers wallbang-mongodb-backup.timer
```

## Migrating to a New VPS

The backup utility is self-contained; migrating the *website* does not require
migrating backups. Follow this whenever the app moves to another provider.

1. **Provision Ubuntu 22.04/24.04** and confirm you can `sudo` and reach
   `cloud.mongodb.com` and `*.backblazeb2.com`.
2. **Clone or download the repository** (or copy just
   `infra/mongodb-backup/` — it has no other dependencies).
3. **Install MongoDB Database Tools and rclone** — `sudo ./install.sh` does
   this automatically; use `--no-deps` if you manage packages yourself.
4. **Configure the existing Backblaze B2 application key and encrypted remote.**
   Reuse the same bucket and the same crypt remote name so existing archives
   stay readable:
   ```bash
   # Reuse the SAME bucket, remote names, crypt password and salt, otherwise
   # existing archives become unreadable. Then either:
   sudo wallbang-backup-setup          # reads B2_*/CRYPT_* from backup.env
   # or configure rclone by hand:
   #   sudo rclone --config /etc/wallbang-backup/rclone.conf config create ...
   ```
   Restoring history is a matter of listing the remote; nothing is imported into
   the new VPS.
5. **Restore MongoDB Atlas credentials** from your password manager/secret
   store into `MONGODB_URI` (or re-create an equivalent backup-only Atlas user).
6. **Run the installation script** (`sudo ./install.sh`). It never overwrites an
   existing `/etc/wallbang-backup/backup.env` and never deletes backups.
7. **Validate the configuration without a production dump**:
   ```bash
   sudo wallbang-backup-verify --remote     # remote reachable, backups present
   sudo wallbang-backup --dry-run           # dumps + validates locally, no upload
   ```
8. **Test access to existing remote backups** (see "Verify and restore").
   Confirm you can list and read an archive written by the old VPS.
9. **Run a manual backup and verify its uploaded copy**:
   ```bash
   sudo wallbang-backup && sudo wallbang-backup-verify --latest --remote
   ```
10. **Enable the daily timer**: `sudo systemctl enable --now wallbang-mongodb-backup.timer`.
11. **Verify the first scheduled run**: `systemctl list-timers` and
    `journalctl -u wallbang-mongodb-backup --since "-1 day"`.
12. **Decommission the old VPS only after** the new host has produced at least
    one successful scheduled run *and* you have confirmed the archive exists in
    B2 and restores into a test cluster.

### If the old VPS is unavailable

Nothing is lost: the backups live in B2, and the crypt remote is reproducible
from the escrowed secrets. On a fresh VPS: follow steps 1–5 above (skipping any
dependency on the old host), then restore the newest archive into a **test**
cluster to confirm your secrets are correct:

```bash
sudo wallbang-backup-verify --latest --remote          # is the remote readable?
sudo wallbang-backup-restore \
  --archive "wallbang-backup-crypt:mongodb/<stamp>/mongodb-<stamp>.archive.gz" \
  --target-uri "mongodb+srv://<test-user>:<pass>@<test-cluster>/" \
  --ns-from 'wallbang.*' --ns-to 'wallbang_restore.*' \
  --confirm
```

### Restoring into a separate Atlas test cluster

1. Create a small test cluster (or a scratch database on an existing one).
2. Use a dedicated restore user with `readWrite` on the target.
3. Always restore into renamed namespaces first (as above) so production data is
   never touched. Omit `--drop`; it is only needed when you deliberately want to
   replace collections *inside those renamed namespaces*.
4. Scripts include a **Path Safety** check: when `--target-uri` equals the
   configured `MONGODB_URI`, the restore refuses to run without
   `--allow-production`.

## Verify and restore commands

```bash
# Verify the newest local backup (checksum + age)
sudo wallbang-backup-verify --latest

# Verify every local backup, and confirm the remote is reachable
sudo wallbang-backup-verify --all --remote

# Fail if the newest backup is older than 2 days
sudo wallbang-backup-verify --latest --max-age-days 2

# Disaster recovery, one command, no credentials on the CLI:
# lists the restore points on B2, prompts for one, prompts for 'restore',
# then REPLACES the target with that restore point (collections contained in
# the archive are dropped first) using MONGODB_URI from backup.env.
sudo wallbang-backup-restore --pick
sudo wallbang-backup-restore --pick --dry-run        # same, but writes nothing
sudo wallbang-backup-restore --pick --merge          # insert-only, keep live docs
sudo wallbang-backup-restore --pick --ns-to 'wallbang_restore.*'   # rehearse elsewhere

# Newest backup without prompting (add --remote for the off-site copy)
sudo wallbang-backup-restore --latest --remote \
  --target-uri "mongodb+srv://test-user:pass@test-cluster/" --confirm

# Dry-run (no writes) from a specific local archive
sudo wallbang-backup-restore --archive /var/backups/wallbang-mongodb/<stamp>/mongodb-<stamp>.archive.gz \
  --target-uri "mongodb+srv://test-user:pass@test-cluster/" --dry-run --confirm

# Real restore into a test cluster, renamed namespaces, no --drop
sudo wallbang-backup-restore \
  --archive /var/backups/wallbang-mongodb/<stamp>/mongodb-<stamp>.archive.gz \
  --target-uri "mongodb+srv://test-user:pass@test-cluster/" \
  --ns-from 'wallbang.*' --ns-to 'wallbang_restore.*' --confirm
```

**Merge vs replace:** `--pick` replaces by default (`--drop`, i.e. the archive's
collections are dropped and restored, giving the DB the restore point's state).
`--merge` inserts missing documents and leaves existing ones untouched — useful
for rehearsals, but it will *not* revert edits or deletions. Collections not
present in the archive are never touched either way, so clean up any scratch
databases you created yourself.

`--latest` resolves the newest backup for you: local by default, or the newest
off-site archive with `--latest --remote` (its checksum sidecar is fetched and
verified too). Exit codes: `0` ok, `1` config, `2` prerequisite, `3` dump,
`4` validation, `5` upload, `6` verification, `7` prune, `8` missing
confirmation, `9` setup failure, `75` another run holds the lock.

## Secrets, encryption and escrow

Never commit: B2 application key, `MONGODB_URI`, `rclone.conf`, crypt password,
crypt salt, rclone config password, Discord webhook.

Store them in a password manager or secret store (Bitwarden/1Password/Vault) —
**not** only on the VPS. Keep at least:

| Secret | Why it matters |
| --- | --- |
| B2 key ID + secret | Re-create the remote on a new host. Re-issuable in B2 if lost. |
| crypt `password` | Without it, encrypted archives are unreadable. |
| crypt `password2` (salt) | Required to derive the key; required even if the password is known. |
| rclone config password | Only if `rclone.conf` is encrypted. |
| Atlas backup user credentials | Re-creatable in Atlas; keep for audit. |

**Loss of the crypt password or salt does not destroy the only surviving
backups** provided you follow this procedure:

1. Escrow the password + salt in a password manager *at creation time*.
2. Additionally keep an offline copy of the newest archive **unencrypted** in a
   separate location if the data is irreplaceable, e.g.:
   ```bash
   # local, unencrypted copy on an encrypted disk / another provider
   mongodump --uri "$MONGODB_URI" --gzip --archive=/secure/mongodb-plain.archive.gz
   ```
   (This is a deliberate trade-off: it protects against crypt-secret loss at the
   cost of a plaintext copy. Do not upload it to a public bucket.)
3. Record the crypt parameters in your runbook so a successor can rebuild the
   remote.

## Why credentials live in `rclone.conf` (not only `backup.env`)

`wallbang-backup-setup` reads B2/crypt values from `backup.env` so you only have
one file to fill in, but the operational copy ends up in rclone's own config:

- plain `rclone lsd/copy/config` recovery commands work without exporting env vars;
- a crypt remote must hold `password`/`password2` anyway, so env-only storage
  would split one secret set across two mechanisms;
- environment variables are visible in `/proc/<pid>/environ`, while a `0600`
  config file is not.

Both files are root-owned `0600`. Keep the **plaintext** crypt password and salt
in your password manager — they are what make the archives decryptable.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Config file not found` | Install the utility and edit `/etc/wallbang-backup/backup.env`. |
| `Missing required config values: MONGODB_URI` | Fill in the config (values are quoted). |
| `Cannot reach remote …` | B2 key expired, bucket renamed, or rclone remote name wrong: `sudo rclone lsd <crypt>:`. |
| Installer 404s on the MongoDB apt repo | Fixed: the installer now picks a repo series that exists for your Ubuntu release (24.04/noble → 8.0) and falls back to the official `.deb`, removing any repo it added if that fails. Re-run `sudo ./install.sh` after a `git pull`. |
| `mongodump failed` | Atlas user lacks `readAnyDatabase`, IP not allow-listed, or SRV string stale. Check `journalctl -u wallbang-mongodb-backup`. |
| `Archive validation failed` | Archive truncated (disk full during dump) — check `MIN_FREE_DISK_MB` and `df -h`. |
| `another backup run is already in progress` | Overlap; the lock file is `/var/lock/wallbang-mongodb-backup.lock`. |
| `Remote size mismatch` | Upload interrupted; re-run. Do not prune; old backups are still intact. |
| Verification says `BAD checksum` | Local archive corrupted (disk). Re-run a backup; remote copies are unaffected. |
| Timer never fires | `systemctl status wallbang-mongodb-backup.timer`; check `ConditionPathExists=/etc/wallbang-backup/backup.env`. |
| Discord notifications missing | Webhook URL empty or revoked; notifications are optional and non-fatal. |

Diagnostics:

```bash
journalctl -u wallbang-mongodb-backup -n 200 --no-pager
tail -n 100 /var/log/wallbang-backup/backup.log
systemctl list-timers 'wallbang-*'
ls -lh /var/backups/wallbang-mongodb
sudo rclone --config /etc/wallbang-backup/rclone.conf lsf <crypt-remote>:<path> | tail
```

## Tests

Dependency-free test suite (no root, no Mongo, no network, mocked tools):

```bash
infra/mongodb-backup/tests/run-tests.sh
```

Covers config validation, secret redaction, lock contention, dump/validate/
upload failure paths, retention pruning, verification (checksum mismatch,
staleness, remote), restore safety guards, and installer idempotency.

## Design notes and limitations

- **Prune order** is strict: upload → verify → prune. A failed run never deletes
  older backups.
- **Credentials** are passed to `mongodump`/`mongorestore` via a `0600`
  `--config` file (Database Tools 100.5.0+), keeping them out of `ps` and logs;
  the file is removed afterwards.
- **B2 versions**: rclone's delete hides objects by default (`--b2-hard-delete`
  changes that). Configure a lifecycle rule if you want versions expiring.
- **Retention is time-based**, not count-based; a long outage simply leaves the
  newest archive older than the window (verification will flag it).
- `--oplog` is intentionally not used: it needs extra Atlas privileges and the
  per-night snapshot is sufficient for this use case.
