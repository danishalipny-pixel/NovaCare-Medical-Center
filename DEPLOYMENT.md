# NovaCare Hospital Management System — Production Deployment Manual

This guide outlines the end-to-end production deployment process for the **NovaCare Hospital Management System**.

---

## ⚠️ Architectural Notice: GitHub Is Not the Backend Host
> **CRITICAL CONCEPT**: GitHub is a version control repository hosting service; it **does NOT run Node.js/Express server processes** or host live production MySQL databases.
>
> To run NovaCare live on the internet, you need:
> 1. A **Source Repository** (GitHub).
> 2. A **Compute Host** for the Node.js/Express server (e.g., Railway, Render, DigitalOcean, AWS EC2, or Ubuntu VPS).
> 3. A **Managed Database Host** for MySQL 8.0+ (e.g., Railway MySQL, Render PostgreSQL/MySQL, AWS RDS, PlanetScale, or self-hosted MySQL).

---

## Deployment Process Overview (9-Step Protocol)

```mermaid
flowchart TD
    A["1. Push Source to GitHub"] --> B["2. Provision MySQL Database"]
    B --> C["3. Provision Node.js Compute Host"]
    C --> D["4. Set Secure Environment Variables"]
    D --> E["5. Run Database Migrations (npm run db:migrate)"]
    E --> F["6. Seed Initial Data (npm run db:seed)"]
    F --> G["7. Configure Custom Domain & SSL/HTTPS"]
    G --> H["8. Start Backend with Process Manager (PM2 / Docker)"]
    H --> I["9. Run Live Health & Diagnostic Verification"]
```

---

## Deployment Option A: Railway (Recommended — Full-Stack in 5 Minutes)

Railway provides integrated Node.js hosting with a native MySQL database plugin.

### Step 1: Push Code to GitHub
```bash
git add .
git commit -m "feat: complete production-ready NovaCare Hospital Management System"
git branch -M main
git remote add origin https://github.com/<your-username>/novacare-hospital-management-system.git
git push -u origin main
```

### Step 2: Create Railway Project & Provision MySQL
1. Log in to [Railway.app](https://railway.app).
2. Click **New Project** → **Provision MySQL**.
3. Railway automatically generates connection variables:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`
   - `MYSQLDATABASE`
   - `MYSQL_URL`

### Step 3: Deploy Application Service
1. In the same Railway project, click **New** → **GitHub Repo**.
2. Select your `novacare-hospital-management-system` repository.
3. In **Variables**, map the database variables:
   ```env
   NODE_ENV=production
   PORT=5000
   DB_CLIENT=mysql
   DB_HOST=${{MySQL.MYSQLHOST}}
   DB_PORT=${{MySQL.MYSQLPORT}}
   DB_USER=${{MySQL.MYSQLUSER}}
   DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
   DB_NAME=${{MySQL.MYSQLDATABASE}}
   DB_SSL=false
   JWT_SECRET=generate_with_openssl_rand_hex_32
   JWT_EXPIRES_IN=24h
   CORS_ORIGIN=https://${{RAILWAY_PUBLIC_DOMAIN}}
   ```

### Step 4: Run Migrations & Seeder
In Railway's web terminal or CLI:
```bash
railway run npm run db:migrate
railway run npm run db:seed
```

### Step 5: Verify Deployment
Visit:
`https://<your-railway-domain>.up.railway.app/api/health`

---

## Deployment Option B: Render + Managed Cloud Database

### Step 1: Provision MySQL Database
Create a MySQL instance on [Aiven](https://aiven.io), [AWS RDS](https://aws.amazon.com/rds/), or [PlanetScale](https://planetscale.com). Note your connection URI:
`mysql://user:password@hostname:3306/novacare_hospital_db?ssl=true`

### Step 2: Create Render Web Service
1. In [Render Dashboard](https://dashboard.render.com), click **New +** → **Web Service**.
2. Connect your GitHub repository.
3. Configure:
   - **Environment**: `Node`
   - **Build Command**: `npm ci`
   - **Start Command**: `npm run db:migrate && npm start`
   - **Plan**: Starter or Standard

### Step 3: Set Environment Variables on Render
Under **Environment Variables**:
| Key | Example Value |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DB_CLIENT` | `mysql` |
| `DATABASE_URL` | `mysql://user:password@hostname:3306/novacare_hospital_db?ssl=true` |
| `DB_SSL` | `true` |
| `JWT_SECRET` | `64_character_hexadecimal_string` |
| `JWT_EXPIRES_IN` | `24h` |
| `CORS_ORIGIN` | `https://novacare.onrender.com` |

---

## Deployment Option C: Ubuntu 22.04 / 24.04 VPS (DigitalOcean / AWS EC2)

For enterprise, self-hosted, or HIPAA/GDPR private cloud deployments.

### 1. Server System Preparation
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw nginx mysql-server build-essential
```

### 2. Node.js 22 LTS Installation
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

### 3. MySQL Server Configuration
```bash
sudo mysql_secure_installation

sudo mysql -u root -p
```
Inside the MySQL shell:
```sql
CREATE DATABASE novacare_hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'novacare_user'@'localhost' IDENTIFIED BY 'StrongHospitalPassword2026!';
GRANT ALL PRIVILEGES ON novacare_hospital_db.* TO 'novacare_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 4. Clone Repository & Install Dependencies
```bash
cd /var/www
sudo git clone https://github.com/<your-username>/novacare-hospital-management-system.git
cd novacare-hospital-management-system
sudo chown -R $USER:$USER .

npm ci --omit=dev
```

### 5. Create Secure Production `.env`
```bash
cp .env.example .env
nano .env
```
Fill with live credentials:
```env
NODE_ENV=production
PORT=5000
HOST=127.0.0.1
DB_CLIENT=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=novacare_user
DB_PASSWORD=StrongHospitalPassword2026!
DB_NAME=novacare_hospital_db
DB_SSL=false
JWT_SECRET=super_secret_production_key_minimum_32_characters
CORS_ORIGIN=https://hospital.yourdomain.com
```

### 6. Run Migrations & Seeds
```bash
npm run db:migrate
npm run db:seed
```

### 7. Process Manager (PM2) Daemonization
```bash
pm2 start server.js --name "novacare-api" --instances max --exec-mode cluster
pm2 save
pm2 startup
```

### 8. Nginx Reverse Proxy Configuration
Create `/etc/nginx/sites-available/novacare`:
```nginx
server {
    listen 80;
    server_name hospital.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
Enable site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/novacare /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 9. Free Let's Encrypt SSL / HTTPS
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d hospital.yourdomain.com
```

---

## Deployment Option D: Docker & Docker Compose

For microservice environments or container clusters:

```bash
# 1. Clone repository
git clone https://github.com/<your-username>/novacare-hospital-management-system.git
cd novacare-hospital-management-system

# 2. Configure .env file
cp .env.example .env

# 3. Start containers
docker compose up -d --build

# 4. View logs
docker compose logs -f app
```

---

## Database Backup and Disaster Recovery

### Automated Database Backup (`mysqldump`)
```bash
# Manual Backup
mysqldump -u novacare_user -p --single-transaction --quick --lock-tables=false novacare_hospital_db > /backups/novacare_backup_$(date +%F_%T).sql

# Compress Backup
gzip /backups/novacare_backup_*.sql
```

### Restore Procedure
```bash
gunzip < /backups/novacare_backup_YYYY-MM-DD.sql.gz | mysql -u novacare_user -p novacare_hospital_db
```

---

## Deployment Verification Checklist (Pass/Fail Criteria)

| # | Check Item | Verification Command / URL | Criteria |
| :- | :--- | :--- | :--- |
| 1 | **Frontend Asset Loading** | `GET https://<domain>/` | Loads CSS, JS, and HTML with HTTP 200 |
| 2 | **API Health Status** | `GET https://<domain>/api/health` | HTTP 200, `status: "healthy"`, DB connected |
| 3 | **Authentication** | `POST /api/auth/login` | Valid accounts return JWT; bad return 401 |
| 4 | **Patient Registration** | `POST /api/patients` | Generates unique UHID (`NC-2026-XXXX`) |
| 5 | **Slot Conflict Protection** | `POST /api/appointments` | Double-booking returns 409 Conflict |
| 6 | **Payment Workflow** | `POST /api/billing/payments` | Updates invoice balance and status |
| 7 | **Zero Localhost Leak** | Network DevTools Inspector | All API calls target same-origin `/api` or custom cloud URL |
| 8 | **Zero Secrets in Git** | GitHub Repository Scan | No `.env`, real passwords, or private keys present |
