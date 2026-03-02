# Deploy Lean 4 Bridge on DigitalOcean

Step-by-step guide to get a live Lean 4 verification server using your **GitHub Student Developer Pack** ($200 DigitalOcean credit).

**Time:** ~30 minutes  
**Cost:** $0 (covered by student credits)

---

## Step 1: Create a DigitalOcean Droplet

1. Go to [digitalocean.com](https://www.digitalocean.com/) → Sign up with your GitHub student account
2. Redeem your **$200 credit** from [education.github.com/pack](https://education.github.com/pack)
3. Create a new **Droplet**:
   - **Image:** Ubuntu 24.04 LTS
   - **Plan:** Basic → Regular → **$6/mo** (1 GB RAM, 25 GB SSD)
     - ⚠️ Lean needs memory; $6/mo is minimum. $12/mo (2 GB) is more comfortable
   - **Region:** Pick one near you (NYC, SFO, etc.)
   - **Authentication:** SSH Key (recommended) or Password
4. Click **Create Droplet** → note the IP address (e.g., `157.245.123.45`)

---

## Step 2: Install Lean 4 + Mathlib

SSH into your droplet:

```bash
ssh root@YOUR_DROPLET_IP
```

Install dependencies:

```bash
apt update && apt install -y git curl build-essential
```

Install elan (Lean version manager):

```bash
curl -sSf https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh | sh -s -- -y
source ~/.profile
```

Verify Lean is installed:

```bash
lean --version
# Should output: leanprover/lean4:v4.x.0
```

---

## Step 3: Clone and Configure Theoremis Bridge

```bash
cd /opt
git clone https://github.com/adamouksili/theoremis.git
cd theoremis
```

Install Node.js (for running the bridge server):

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install
```

Set the CORS origin for your domain:

```bash
export SIGMA_CORS_ORIGIN="https://www.theoremis.com"
```

Test the bridge:

```bash
npx tsx src/bridge/lean-server.ts
```

You should see:

```
  ╔══════════════════════════════════════════╗
  ║  Theoremis Lean Bridge · port 9473       ║
  ║  POST /verify  { code, language }        ║
  ║  GET  /health                            ║
  ╚══════════════════════════════════════════╝
```

Test it (open another SSH session or use tmux):

```bash
curl http://localhost:9473/health
# {"status":"ok","lean":"leanprover/lean4:v4.x.0"}
```

---

## Step 4: Run as a Systemd Service

Create a service file so the bridge runs permanently:

```bash
cat > /etc/systemd/system/theoremis-bridge.service << 'EOF'
[Unit]
Description=Theoremis Lean 4 Bridge
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/theoremis
Environment=SIGMA_CORS_ORIGIN=https://www.theoremis.com
ExecStart=/usr/bin/npx tsx src/bridge/lean-server.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
systemctl daemon-reload
systemctl enable theoremis-bridge
systemctl start theoremis-bridge
systemctl status theoremis-bridge  # Should show "active (running)"
```

---

## Step 5: Open the Port

Allow traffic on port 9473:

```bash
ufw allow 9473/tcp
```

Test from your local machine:

```bash
curl http://YOUR_DROPLET_IP:9473/health
```

---

## Step 6: Connect Theoremis IDE

1. Open [theoremis.com/#ide](https://www.theoremis.com/#ide)
2. Open browser console (Cmd+Option+J on Mac)
3. Run:

```javascript
localStorage.setItem('theoremis-bridge-url', 'http://YOUR_DROPLET_IP:9473')
```

4. Reload the page
5. The bridge status should change from **● Offline** to **● Online** 🎉

---

## Optional: Add HTTPS with Nginx

For production use, put Nginx in front with a free Let's Encrypt certificate:

```bash
apt install -y nginx certbot python3-certbot-nginx

# Create Nginx config
cat > /etc/nginx/sites-available/lean-bridge << 'EOF'
server {
    listen 80;
    server_name lean.theoremis.com;  # Point this DNS to your droplet

    location / {
        proxy_pass http://127.0.0.1:9473;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "https://www.theoremis.com" always;
        add_header Access-Control-Allow-Methods "POST, GET, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
}
EOF

ln -s /etc/nginx/sites-available/lean-bridge /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Get HTTPS certificate
certbot --nginx -d lean.theoremis.com
```

Then update your bridge URL to use HTTPS:

```javascript
localStorage.setItem('theoremis-bridge-url', 'https://lean.theoremis.com')
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `lean: command not found` | Run `source ~/.profile` or check `~/.elan/bin/lean` |
| Bridge exits immediately | Check `journalctl -u theoremis-bridge -f` for errors |
| CORS errors in browser | Verify `SIGMA_CORS_ORIGIN` is set to your domain |
| Lean timeout on first run | First compilation downloads Mathlib cache (~2-5 min). Subsequent runs are fast. |
| Out of memory | Upgrade to $12/mo droplet (2 GB RAM) |
