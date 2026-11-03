# DevOpsHub – DevOps, CI/CD & Monitoring (Step-by-Step Guide)

Yeh project ek chhoti si web app (**DevOpsHub Task Tracker**) hai jis par aap poora DevOps cycle practice karte hain:

```
GitHub  →  Build  →  Test  →  Docker  →  Deploy  →  Monitor
(code)    (lint)   (auto)    (image)    (staging/   (logs, metrics,
                                         production)  Grafana, alerts)
```

## Key Objectives – kahan cover hota hai

| # | Objective | Kahan hai |
|---|-----------|-----------|
| 1 | DevOps culture, Git/GitHub workflow, CI/CD concepts | Part 1, Part 2 |
| 2 | Automated testing, build, deployment, environment management | Part 3, 4, 6, 7, 8 |
| 3 | Monitoring: GitHub → Build → Test → Docker → Deploy → Monitor | Part 5, 9 |

---

## Project Structure

```
devopshub-app/
├── src/
│   ├── server.js        # app start + graceful shutdown
│   ├── app.js           # routes: /, /health, /metrics, /api/tasks
│   ├── tasks.js         # in-memory task store
│   ├── logger.js        # JSON structured logs
│   └── metrics.js       # Prometheus metrics (devopshub_*)
├── public/index.html    # Web UI
├── test/app.test.js     # automated tests (node:test)
├── scripts/smoke-test.sh        # deploy ke baad health check
├── Dockerfile                   # devopshub-app image
├── docker-compose.yml           # devopshub-app + prometheus + grafana
├── monitoring/                  # prometheus, alerts, grafana dashboard
├── .github/workflows/ci-cd.yml  # poori pipeline
├── .github/pull_request_template.md
├── .env.example
└── package.json
```

**App ka naam har jagah same hai:** `devopshub-app` (package, Docker image, compose service, Prometheus job, metrics prefix `devopshub_`).

---

## Part 1 – DevOps Culture (samajhna zaroori hai)

DevOps tool nahi, **culture** hai: Development + Operations ek team ki tarah kaam karein.

1. **Automation** – jo kaam bar bar manual hota hai (test, build, deploy) usay pipeline kare.
2. **Small, frequent changes** – chhote PR, roz merge; bade releases se risk badhta hai.
3. **Shift left** – bugs jaldi pakdo (PR ke waqt, production mein nahi).
4. **Everything as code** – pipeline (`ci-cd.yml`), infrastructure (`docker-compose.yml`), monitoring (`prometheus.yml`) sab Git mein.
5. **Fast feedback + shared ownership** – pipeline fail ho to team fix kare; "mere machine par chal raha hai" nahi chalta.
6. **Measure everything** – logs, metrics, alerts ke baghair deploy andhera hai.

**CI vs CD:**
- **CI (Continuous Integration):** har push/PR par automatically lint + test + build.
- **CD (Continuous Delivery/Deployment):** pass hone ke baad automatically staging/production par deploy.

---

## Part 2 – Local Setup & Git/GitHub Workflow

### Step 2.1 – Prerequisites
- Git, Node.js 18+ (20 recommended), Docker + Docker Compose, GitHub account.

### Step 2.2 – App local chalao (bina Docker)
```bash
cd devopshub-app
npm run lint
npm test
npm start
# browser: http://localhost:3000
```
Check karo:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

### Step 2.3 – GitHub repo banao aur push karo
```bash
git init
git add .
git commit -m "feat: initial devopshub-app"
git branch -M main
git remote add origin https://github.com/<your-username>/devopshub-app.git
git push -u origin main

# develop branch (staging ke liye)
git checkout -b develop
git push -u origin develop
```

### Step 2.4 – Branching strategy

| Branch | Kaam | Deploy kahan |
|--------|------|--------------|
| `feature/*` | naya kaam | sirf CI (test) |
| `develop` | integration | **staging** |
| `main` | stable release | **production** (approval ke sath) |

Roz ka flow:
```bash
git checkout develop && git pull
git checkout -b feature/add-task-priority
# ... code, test ...
git add . && git commit -m "feat: add task priority"
git push -u origin feature/add-task-priority
# GitHub par PR kholo: feature/add-task-priority -> develop
```

Commit message convention: `feat:`, `fix:`, `docs:`, `chore:`, `test:`.

### Step 2.5 – Branch protection (GitHub Settings → Branches)
`main` aur `develop` dono par rule add karo:
- ✅ Require a pull request before merging
- ✅ Require status checks to pass → `Lint & Test (Node 20)` select karo (pipeline ek baar chal chuki ho tab list mein dikhega)
- ✅ Require branches to be up to date

Is se koi bhi bina test pass kiye code merge nahi kar sakta.

---

## Part 3 – Automated Testing

Tests `test/app.test.js` mein hain (Node ka built-in `node:test`, koi extra package nahi).

```bash
npm test
```
Yeh cover karte hain: `/health`, UI page, task create/validate/toggle/delete, 404, `/metrics`.

**Practice:** naya test likho (e.g. empty title `"   "` par 400) aur dekho pipeline kaise fail/pass hoti hai. Pipeline mein test **Node 18, 20, 22** par matrix mein chalta hai.

---

## Part 4 – Build Automation: Docker

### Step 4.1 – Image build
```bash
docker build -t devopshub-app:local --build-arg APP_VERSION=local .
```

### Step 4.2 – Container chalao
```bash
docker run -d --name devopshub-app -p 3000:3000 -e APP_ENV=development devopshub-app:local
bash scripts/smoke-test.sh http://localhost:3000 development
docker logs devopshub-app          # JSON logs
docker rm -f devopshub-app
```

Dockerfile ki khaas baatein: non-root user (`USER node`), `HEALTHCHECK`, chhoti alpine image.

---

## Part 5 – Monitoring (Logs + Metrics + Dashboard)

### Step 5.1 – Poora stack local chalao
```bash
cp .env.example .env
docker compose up -d --build
docker compose ps
```

| Service | URL |
|---------|-----|
| devopshub-app | http://localhost:3000 |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3001 (user: `admin`, password: `.env` mein `GRAFANA_PASSWORD`) |

### Step 5.2 – Traffic generate karo
```bash
for i in $(seq 1 50); do
  curl -s -X POST localhost:3000/api/tasks -H 'Content-Type: application/json' -d "{\"title\":\"task $i\"}" > /dev/null
  curl -s localhost:3000/api/tasks > /dev/null
done
curl -s localhost:3000/does-not-exist      # 404 generate
```

### Step 5.3 – Logs dekho (basic observability)
```bash
docker compose logs -f devopshub-app
docker compose logs devopshub-app | grep '"status":404'
docker compose logs --since 10m devopshub-app
```
Har request ek JSON line hai: `time`, `level`, `route`, `status`, `durationMs`.

### Step 5.4 – Metrics dekho
- Prometheus → **Status → Targets**: `devopshub-app` **UP** hona chahiye.
- Prometheus → **Graph**, queries:
  ```
  sum(rate(devopshub_http_requests_total[1m])) by (route)
  histogram_quantile(0.95, sum(rate(devopshub_http_request_duration_seconds_bucket[5m])) by (le))
  devopshub_tasks_total
  ```
- Grafana → **Dashboards → DevOpsHub → DevOpsHub App Overview** (auto-provisioned): status, tasks, uptime, version/env, request rate, errors, p95 latency.

### Step 5.5 – Alerts
`monitoring/alerts.yml` mein 3 alerts hain: **DevOpsHubAppDown**, **DevOpsHubHighErrorRate**, **DevOpsHubSlowRequests**.
Test: `docker compose stop devopshub-app` → 1 minute baad Prometheus → **Alerts** mein `DevOpsHubAppDown` **FIRING**. Phir `docker compose start devopshub-app`.

> Production mein Alertmanager se Slack/Email notification add karte hain (next step).

---

## Part 6 – CI Pipeline (GitHub Actions)

File: `.github/workflows/ci-cd.yml`. Jobs ka flow:

```
push / PR
   │
   ▼
[test]  Lint + npm test  (Node 18/20/22)
   │ (pass)
   ▼
[docker]  build → container smoke test → push to GHCR   (push par hi)
   │ (pass)
   ▼
[deploy]  develop → staging | main → production
          scp files → ssh → compose pull/up → smoke test → auto-rollback
```

- **Pull Request par:** sirf `test` + `docker` build/smoke test (push nahi, deploy nahi).
- **`develop` par push:** test → docker push → **staging** deploy.
- **`main` par push:** test → docker push → **production** deploy (approval ke baad).

Image GHCR par is naam se jati hai: `ghcr.io/<owner>/devopshub-app:sha-<commit>` (aur branch tag).

**Pehla run:** GitHub → **Actions** tab → "DevOpsHub CI-CD Pipeline". Test aur docker jobs bina kisi setup ke chal jayenge. Deploy job ke liye Part 7 karna hoga.

---

## Part 7 – Environments & Server Setup (CD ki tayyari)

### Step 7.1 – Server lo
Koi bhi Ubuntu VPS/VM (AWS EC2, DigitalOcean, Azure, ya local VM). Staging aur production ke liye 2 alag server ya ek hi server par alag ports (guide ek server maan kar chalti hai).

### Step 7.2 – Server par Docker install
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER      # logout/login ke baad
docker --version && docker compose version
```

### Step 7.3 – Deploy ke liye SSH key
Apne laptop par:
```bash
ssh-keygen -t ed25519 -f deploy_key -C "devopshub-deploy" -N ""
ssh-copy-id -i deploy_key.pub <user>@<server-ip>
ssh -i deploy_key <user>@<server-ip> "docker ps"     # test
```
`deploy_key` (private) GitHub secret mein jayegi; **kabhi commit mat karna.**

### Step 7.4 – Firewall
Server par ye ports kholo: `22` (SSH), staging `8081`, `9091`, `3011`, production `8080`, `9090`, `3010` (ya apni marzi ke ports).

### Step 7.5 – GitHub Environments banao
Repo → **Settings → Environments → New environment**: `staging` aur `production`.

**Har environment mein Secrets:**

| Secret | Value |
|--------|-------|
| `SSH_HOST` | server IP |
| `SSH_USER` | server user |
| `SSH_PRIVATE_KEY` | `deploy_key` ka poora content |
| `GRAFANA_PASSWORD` | Grafana admin password (har env ka alag) |

**Har environment mein Variables:**

| Variable | staging | production |
|----------|---------|------------|
| `APP_PORT` | `8081` | `8080` |
| `PROM_PORT` | `9091` | `9090` |
| `GRAFANA_PORT` | `3011` | `3010` |

**Production protection:** `production` environment → **Required reviewers** mein khud ko/team lead ko add karo → ab production deploy manual approval ke baad hi chalega.
Optional: **Deployment branches** → sirf `main`.

> Server par pehli baar GHCR image pull private package ho to pipeline `GITHUB_TOKEN` se login khud kar leti hai. Agar package public rakhna ho: GitHub profile → Packages → `devopshub-app` → Package settings → visibility.

---

## Part 8 – Continuous Deployment (Step by Step Demo)

### Step 8.1 – Staging deploy
```bash
git checkout develop
echo "// trigger" >> src/server.js   # ya koi asli change
git add . && git commit -m "feat: first staging deploy" && git push
```
Actions tab mein dekho: `test` → `docker` → `deploy (staging)`.

Verify:
```bash
curl http://<server-ip>:8081/health      # {"status":"ok","env":"staging","version":"sha-xxxxxxx"}
```
Browser: `http://<server-ip>:8081` – UI ke neeche `env: staging | version: sha-xxxxxxx` dikhega.

### Step 8.2 – Production release
```bash
# GitHub par PR: develop -> main, CI pass hone ke baad merge
```
Merge ke baad `deploy (production)` job **Waiting for approval** par rukega → reviewer **Approve** kare → deploy chalega.

```bash
curl http://<server-ip>:8080/health      # env: production
```

### Step 8.3 – Smoke test + auto-rollback
Deploy ke andar `scripts/smoke-test.sh` chalta hai: `/health`, sahi environment, `/metrics`, `/api/tasks`. Fail ho to pichli `.env` wapas laga kar purani image chalti hai aur job fail dikhata hai.

### Step 8.4 – Manual rollback (agar baad mein masla mile)
Server par:
```bash
cd ~/devopshub/production
cat .env.previous                     # purani IMAGE dekho
cp .env.previous .env
docker compose -p devopshub-production up -d --no-build
```
Ya GitHub mein purane commit par `git revert` karke push karo (recommended – Git history sach rehti hai).

---

## Part 9 – Full End-to-End Practice (Monitor tak)

Yeh poora loop ek baar khud karo:

1. `develop` se `feature/health-details` branch banao.
2. `src/app.js` ke `/health` response mein koi field add karo; `test/app.test.js` mein uska test likho.
3. Push + PR kholo → Actions mein **test** aur **docker** green dekho.
4. PR merge karo `develop` mein → **staging deploy** hota dekho.
5. Staging Grafana kholo (`http://<server-ip>:3011`) → Dashboard mein version/env panel dekho.
6. Staging par traffic generate karo (Part 5.2 jaisa) → request rate aur p95 latency dekho.
7. Jaan bujh kar bug daalo (e.g. test tod do) → PR par pipeline **red** dekho, merge block hota dekho.
8. Bug fix → `develop` → PR `develop → main` → approval → **production**.
9. Server par logs: `docker compose -p devopshub-production logs -f devopshub-app`.
10. `docker stop` kar ke **DevOpsHubAppDown** alert fire karo, phir wapas start karo.

---

## Monitoring Cheat Sheet (server par)

```bash
cd ~/devopshub/production
docker compose -p devopshub-production ps
docker compose -p devopshub-production logs -f --tail=100 devopshub-app
docker compose -p devopshub-production logs devopshub-app | grep '"level":"error"'
docker stats --no-stream
curl -s localhost:8080/metrics | grep devopshub_
```

---

## Troubleshooting

| Masla | Wajah / Hal |
|-------|-------------|
| `npm test` kuch nahi chalata | Node 18+ use karo (`node -v`) |
| Docker job: `denied` push par | Settings → Actions → General → Workflow permissions: **Read and write** |
| Deploy: `Permission denied (publickey)` | `SSH_PRIVATE_KEY` poora paste karo (BEGIN/END lines ke sath) aur public key server par ho |
| Deploy: `pull access denied` | Package private hai aur login fail – package visibility check karo ya `GITHUB_TOKEN` permissions |
| Smoke test fail `env mismatch` | `APP_ENV` environment (staging/production) sahi branch se aa raha hai? |
| Grafana mein data nahi | Prometheus → Targets mein `devopshub-app` UP? `monitoring/prometheus.yml` ka target `devopshub-app:3000` |
| Port already in use | `.env` mein `APP_PORT`, `PROM_PORT`, `GRAFANA_PORT` badlo |
| `scp` fail | Server par target folder banane ki zarurat nahi, lekin user ko home dir mein write permission ho |

---

## Next Steps (agle level ke liye)

- Database add karo (PostgreSQL) + migrations pipeline mein
- Alertmanager + Slack/Email notifications
- Centralized logs (Grafana Loki ya ELK)
- HTTPS (Nginx/Caddy + Let's Encrypt) aur domain
- Security scan pipeline mein (`npm audit`, Trivy image scan)
- Infrastructure as Code (Terraform) aur Kubernetes

---

## Quick Command Reference

```bash
npm run lint && npm test                      # local checks
docker compose up -d --build                  # local full stack
docker compose down -v                        # sab band + volumes delete
bash scripts/smoke-test.sh http://localhost:3000 development
```
