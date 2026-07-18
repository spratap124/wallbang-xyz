# Oracle cutover checklist (operator)

Repo readiness is done on branch `cursor/oracle-docker-deploy-4f7d` (PR).  
The steps below require Oracle / Atlas / DNS console access and an SSH path to the new app VM.

## B — Provision Always Free app VM

1. Create Ubuntu 22.04/24.04 Always Free instance (prefer `ap-mumbai-1`).
2. Shape: `VM.Standard.A1.Flex` (1–2 OCPU / 6–12 GB) or `VM.Standard.E2.1.Micro`.
3. Note public IP as `APP_VM_IP`.
4. Security list / NSG ingress:
   - TCP 22 from your admin IP(s)
   - TCP 80 and 443 from `0.0.0.0/0`
5. Add your SSH public key; confirm:

```bash
ssh ubuntu@APP_VM_IP
```

6. Hand `APP_VM_IP` to the deploy agent (or continue locally).

## C — Game UDP + Atlas

### Prod retake firewall

On `200.97.169.27` (and later each retake server):

- CS2 listening on UDP `27015`
- NSG/security list: inbound UDP `27015` from `APP_VM_IP` (preferred)
- OS firewall allows the same

Verify from the app VM:

```bash
# rough reachability — a real A2S check happens via /api/servers after deploy
nc -u -z -w 2 200.97.169.27 27015 || true
```

### MongoDB Atlas

- DB `wallbang`, user with `readWrite` on that DB only
- Network Access: allow `APP_VM_IP`
- Values for `.env.production`:

```
MONGODB_URI=mongodb+srv://...
MONGODB_DB=wallbang
SERVER_STATUS_TTL_SECONDS=15
SERVER_STATUS_DOC_TTL_SECONDS=120
```

## D — Deploy + TLS on app VM

```bash
git clone git@github.com:spratap124/wallbang-xyz.git
cd wallbang-xyz
git checkout main   # after PR merge; or cursor/oracle-docker-deploy-4f7d beforehand
bash scripts/oracle-bootstrap.sh
nano .env.production   # set MONGODB_URI
docker compose --env-file .env.production up -d --build
curl -s http://127.0.0.1:3000/api/servers | jq
```

Expect `ip: "200.97.169.27:27015"` and `maxPlayers: 10`.

After DNS A records exist:

```bash
sudo certbot --nginx -d wallbang.xyz -d www.wallbang.xyz
```

## E — DNS cutover + verify

1. A `wallbang.xyz` (+ `www`) → `APP_VM_IP`
2. Remove Vercel DNS records
3. Checklist:
   - [ ] `https://wallbang.xyz` and `/servers` load
   - [ ] `/api/servers` → `online: true`, prod IP, `maxPlayers: 10`
   - [ ] Hero + list show live map/players
   - [ ] `steam://connect/200.97.169.27:27015` works
   - [ ] Atlas `serverStatus` + TTL index on `lastPolled`
   - [ ] Container survives reboot
   - [ ] Local `npm run dev` still uses staging `129.159.232.212`
4. Pause/delete the Vercel project when stable

## Update loop

```bash
cd ~/wallbang-xyz
git pull
docker compose --env-file .env.production up -d --build
```
