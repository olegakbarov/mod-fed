# Deployment Guide: Simple Solution

## Overview

This guide covers deploying the Simple Solution to various production environments. The solution is designed to be deployment-friendly with minimal configuration and clear scaling paths.

**Target Environments:**
- Single server deployment (recommended start)
- Docker containers
- Cloud platforms (AWS, Google Cloud, Azure)
- Platform-as-a-Service (Heroku, Railway, Render)

## Pre-Deployment Preparation

### 1. Environment Configuration

Create production environment file:
```bash
cp .env.example .env.production
```

**Required Variables:**
```env
# Security (CRITICAL - Generate new values)
JWT_SECRET=your-64-character-random-secret-here
NODE_ENV=production

# Database
DATABASE_PATH=/data/production.db

# Server
PORT=3000

# AI Integration (Optional)
AI_API_KEY=your-openai-or-anthropic-key
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
```

### 2. Security Setup

**Generate JWT Secret:**
```bash
# Generate cryptographically secure secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Set Environment Permissions:**
```bash
chmod 600 .env.production
```

### 3. Database Preparation

```bash
# Create data directory
mkdir -p /data
chmod 755 /data

# Database will be created automatically on first run
# Migrations run automatically
```

## Single Server Deployment

### Method 1: Direct Node.js

**Prerequisites:**
- Node.js 18+ installed
- Process manager (PM2 recommended)

**Setup:**
```bash
# 1. Install dependencies
npm ci --only=production

# 2. Build application (if TypeScript)
npm run build

# 3. Install PM2
npm install -g pm2

# 4. Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'ai-app-generator-simple',
    script: './dist/simple/app.js',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 'max',
    exec_mode: 'cluster',
    max_memory_restart: '1G',
    error_file: '/var/log/app/error.log',
    out_file: '/var/log/app/out.log',
    log_file: '/var/log/app/combined.log',
    time: true
  }]
}
EOF

# 5. Start application
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

**Verification:**
```bash
# Check application status
pm2 status

# Test health endpoint
curl http://localhost:3000/health

# Monitor logs
pm2 logs
```

### Method 2: Systemd Service

Create systemd service file:
```bash
sudo cat > /etc/systemd/system/ai-app-generator.service << EOF
[Unit]
Description=AI App Generator Simple Solution
After=network.target

[Service]
Type=simple
User=app
WorkingDirectory=/opt/ai-app-generator
ExecStart=/usr/bin/node dist/simple/app.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000
EnvironmentFile=/opt/ai-app-generator/.env.production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable ai-app-generator
sudo systemctl start ai-app-generator

# Check status
sudo systemctl status ai-app-generator
```

## Docker Deployment

### Dockerfile

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S app -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder --chown=app:nodejs /app/dist ./dist
COPY --from=builder --chown=app:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=app:nodejs /app/package*.json ./

# Create data directory
RUN mkdir -p /data && chown app:nodejs /data

# Security hardening
RUN apk --no-cache add dumb-init
RUN rm -rf /var/cache/apk/*

USER app

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/simple/app.js"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATABASE_PATH=/data/production.db
      - AI_API_KEY=${AI_API_KEY}
      - AI_PROVIDER=${AI_PROVIDER}
    volumes:
      - app_data:/data
      - ./logs:/var/log/app
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Optional: Nginx reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  app_data:
    driver: local
```

**Deployment Commands:**
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Scale application
docker-compose up -d --scale app=3
```

## Cloud Platform Deployments

### AWS Elastic Beanstalk

**Prepare deployment:**
```bash
# 1. Install EB CLI
pip install awsebcli

# 2. Initialize Elastic Beanstalk
eb init -p node.js ai-app-generator

# 3. Create environment
eb create production --database.engine sqlite

# 4. Configure environment variables
eb setenv JWT_SECRET=your-secret NODE_ENV=production AI_API_KEY=your-key

# 5. Deploy
eb deploy

# 6. Check status
eb status
eb health
```

**Configuration file (`.ebextensions/01_app.config`):**
```yaml
option_settings:
  aws:autoscaling:launchconfiguration:
    InstanceType: t3.micro
    SecurityGroups: default
  aws:elasticbeanstalk:application:environment:
    NODE_ENV: production
    PORT: 8080
  aws:elasticbeanstalk:container:nodejs:
    NodeCommand: "node dist/simple/app.js"
    NodeVersion: 18.19.0
    ProxyServer: nginx
    GzipCompression: true

files:
  "/opt/elasticbeanstalk/tasks/bundlelogs.d/01-app-logs.conf":
    content: |
      /var/log/nodejs/nodejs.log
```

### Google Cloud Run

**Deploy with Cloud Build:**
```bash
# 1. Enable required APIs
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# 2. Build and deploy
gcloud run deploy ai-app-generator \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,JWT_SECRET=$JWT_SECRET,AI_API_KEY=$AI_API_KEY"

# 3. Get service URL
gcloud run services describe ai-app-generator \
  --platform managed \
  --region us-central1 \
  --format 'value(status.url)'
```

**Cloud Build configuration (`cloudbuild.yaml`):**
```yaml
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-t', 'gcr.io/$PROJECT_ID/ai-app-generator', '.']
  - name: 'gcr.io/cloud-builders/docker'
    args: ['push', 'gcr.io/$PROJECT_ID/ai-app-generator']
  - name: 'gcr.io/cloud-builders/gcloud'
    args:
    - 'run'
    - 'deploy'
    - 'ai-app-generator'
    - '--image=gcr.io/$PROJECT_ID/ai-app-generator'
    - '--region=us-central1'
    - '--platform=managed'
    - '--allow-unauthenticated'
```

### Heroku Deployment

```bash
# 1. Create Heroku app
heroku create your-app-name

# 2. Add buildpack
heroku buildpacks:set heroku/nodejs

# 3. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
heroku config:set AI_API_KEY=your-api-key
heroku config:set AI_PROVIDER=openai

# 4. Create Procfile
echo "web: node dist/simple/app.js" > Procfile

# 5. Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main

# 6. Scale dynos
heroku ps:scale web=1
```

## Load Balancing & Reverse Proxy

### Nginx Configuration

**Main configuration (`/etc/nginx/sites-available/ai-app-generator`):**
```nginx
upstream app_servers {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    server_name yourdomain.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    ssl_prefer_server_ciphers off;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;

    # Main application
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://app_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Stricter rate limiting for auth endpoints
    location /auth/ {
        limit_req zone=auth burst=5 nodelay;
        proxy_pass http://app_servers;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check (no rate limiting)
    location /health {
        proxy_pass http://app_servers;
        access_log off;
    }
}
```

**Enable configuration:**
```bash
sudo ln -s /etc/nginx/sites-available/ai-app-generator /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Database Management

### Backup Strategy

**Daily Backup Script:**
```bash
#!/bin/bash
# /opt/scripts/backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_PATH="/data/production.db"
APP_NAME="ai-app-generator"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
sqlite3 $DB_PATH ".backup $BACKUP_DIR/${APP_NAME}_${DATE}.db"

# Compress backup
gzip "$BACKUP_DIR/${APP_NAME}_${DATE}.db"

# Keep only last 30 days
find $BACKUP_DIR -name "${APP_NAME}_*.db.gz" -mtime +30 -delete

echo "Backup completed: ${APP_NAME}_${DATE}.db.gz"
```

**Setup cron job:**
```bash
# Add to crontab
crontab -e

# Daily backup at 2 AM
0 2 * * * /opt/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

### Database Maintenance

**Weekly maintenance script:**
```bash
#!/bin/bash
# /opt/scripts/db-maintenance.sh

DB_PATH="/data/production.db"

echo "Starting database maintenance..."

# 1. Integrity check
echo "Running integrity check..."
INTEGRITY=$(sqlite3 $DB_PATH "PRAGMA integrity_check;")
if [ "$INTEGRITY" != "ok" ]; then
    echo "ERROR: Database integrity check failed!"
    exit 1
fi

# 2. Vacuum (defragment)
echo "Vacuuming database..."
sqlite3 $DB_PATH "VACUUM;"

# 3. Analyze (update statistics)
echo "Analyzing database..."
sqlite3 $DB_PATH "ANALYZE;"

# 4. Check database size
SIZE=$(du -h $DB_PATH | cut -f1)
echo "Database size: $SIZE"

echo "Database maintenance completed."
```

## Monitoring & Observability

### Application Monitoring

**Health Check Endpoint:**
```bash
# Monitor application health
curl -f http://localhost:3000/health || exit 1
```

**Basic Monitoring Script:**
```bash
#!/bin/bash
# /opt/scripts/monitor.sh

APP_URL="http://localhost:3000"
LOG_FILE="/var/log/monitoring.log"

# Check health endpoint
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" $APP_URL/health)

if [ $HEALTH_STATUS -ne 200 ]; then
    echo "$(date): ALERT - Health check failed. Status: $HEALTH_STATUS" >> $LOG_FILE
    # Send alert (email, Slack, etc.)
else
    echo "$(date): OK - Application healthy" >> $LOG_FILE
fi

# Check database size
DB_SIZE=$(du -h /data/production.db | cut -f1)
echo "$(date): Database size: $DB_SIZE" >> $LOG_FILE

# Check memory usage
MEMORY=$(free -h | awk 'NR==2{printf "%.2f%%", $3/$2*100}')
echo "$(date): Memory usage: $MEMORY" >> $LOG_FILE
```

### Log Management

**Logrotate configuration:**
```bash
# /etc/logrotate.d/ai-app-generator
/var/log/ai-app-generator/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 app app
    postrotate
        systemctl reload ai-app-generator
    endscript
}
```

## SSL/TLS Configuration

### Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt-get update
sudo apt-get install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d yourdomain.com

# Verify auto-renewal
sudo certbot renew --dry-run

# Setup auto-renewal cron
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Manual SSL Certificate

```bash
# Generate private key
openssl genrsa -out yourdomain.key 2048

# Generate certificate signing request
openssl req -new -key yourdomain.key -out yourdomain.csr

# Install certificate files
sudo cp yourdomain.crt /etc/ssl/certs/
sudo cp yourdomain.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/yourdomain.key
```

## Environment-Specific Configurations

### Development
```env
NODE_ENV=development
JWT_SECRET=dev-secret-not-for-production
DATABASE_PATH=./dev.db
PORT=3000
```

### Staging
```env
NODE_ENV=staging
JWT_SECRET=staging-specific-secret
DATABASE_PATH=/data/staging.db
PORT=3000
AI_API_KEY=staging-api-key
```

### Production
```env
NODE_ENV=production
JWT_SECRET=super-secure-64-character-production-secret
DATABASE_PATH=/data/production.db
PORT=3000
AI_API_KEY=production-api-key
```

## Troubleshooting Guide

### Common Issues

**1. Application won't start**
```bash
# Check environment variables
printenv | grep -E "(JWT_SECRET|DATABASE_PATH|NODE_ENV)"

# Check database permissions
ls -la /data/production.db

# Check port availability
netstat -tlnp | grep :3000
```

**2. Database connection errors**
```bash
# Check database file exists
ls -la /data/production.db

# Check database integrity
sqlite3 /data/production.db "PRAGMA integrity_check;"

# Check disk space
df -h /data
```

**3. High memory usage**
```bash
# Check process memory
ps aux | grep node

# Monitor memory usage
top -p $(pgrep -f "node.*app.js")

# Check for memory leaks
node --inspect app.js
```

**4. Rate limiting issues**
```bash
# Check rate limiting logs
grep "Too many requests" /var/log/app/application.log

# Temporary rate limit bypass (use carefully)
# Edit rate-limit.ts and restart application
```

### Performance Issues

**1. Slow response times**
```bash
# Monitor response times
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:3000/health

# Check database performance
sqlite3 /data/production.db "EXPLAIN QUERY PLAN SELECT * FROM users WHERE email = 'test@example.com';"

# Monitor system resources
htop
iotop
```

**2. High CPU usage**
```bash
# Profile Node.js application
node --prof app.js

# Analyze profile
node --prof-process isolate-*-v8.log > processed.txt
```

## Scaling Recommendations

### Vertical Scaling (Single Server)
1. **CPU**: 2-4 cores for 1000+ concurrent users
2. **Memory**: 2-4GB RAM for standard workload
3. **Storage**: SSD for better database performance
4. **Network**: 1Gbps for high-traffic applications

### Horizontal Scaling (Multiple Servers)
1. **Load Balancer**: Nginx or cloud load balancer
2. **Database**: Migrate to PostgreSQL or MySQL
3. **Session Store**: Redis for rate limiting
4. **File Storage**: Cloud storage for assets

### Migration Path
```bash
# 1. Database migration (SQLite → PostgreSQL)
# Export SQLite data
sqlite3 production.db .dump > backup.sql

# Import to PostgreSQL
psql production_db < backup.sql

# 2. Update connection string
DATABASE_URL=postgresql://user:pass@localhost:5432/production_db

# 3. Update application configuration
# Modify database-bun.ts to use PostgreSQL driver
```

## Security Hardening

### Server Security
```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade

# 2. Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# 3. Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sudo systemctl restart sshd

# 4. Setup fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

### Application Security
```bash
# 1. Use non-root user
useradd -m -s /bin/bash app
su - app

# 2. Set proper file permissions
chmod 600 .env.production
chmod 755 /data
chmod 644 /data/production.db

# 3. Setup log monitoring
# Monitor for suspicious activities
grep -i "error\|fail\|attack" /var/log/app/*.log
```

## Maintenance Calendar

### Daily
- [ ] Check application health
- [ ] Monitor error rates
- [ ] Verify backup completion
- [ ] Check disk space

### Weekly
- [ ] Database maintenance (vacuum, analyze)
- [ ] Security log review
- [ ] Performance monitoring
- [ ] Dependency vulnerability scan

### Monthly
- [ ] Update dependencies
- [ ] SSL certificate renewal check
- [ ] Capacity planning review
- [ ] Security configuration review

### Quarterly
- [ ] Major security updates
- [ ] Load testing
- [ ] Disaster recovery test
- [ ] Architecture review

This deployment guide provides comprehensive coverage for deploying the Simple Solution to production. Choose the deployment method that best fits your infrastructure and scaling requirements.