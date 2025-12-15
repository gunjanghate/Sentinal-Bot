# ECWoC Sentinel – Fair & Transparent PR Scoring System

ECWoC Sentinel is a GitHub App–based backend system designed to **fairly, transparently, and scalably score pull requests** during large open-source contribution events.

It eliminates manual bias in PR evaluation by introducing a **rule-based, auditable scoring pipeline** that works reliably even at scale (hundreds of contributors, thousands of PRs).

---

## 🚨 The Problem We’re Solving

In most open-source events today:

- PR difficulty levels (L1 / L2 / L3) are **manually assigned**
- Decisions depend entirely on **project admins**
- There is **no verification mechanism**
- This opens the door to:
  - favoritism
  - inconsistent scoring
  - contributor demotivation
- Result: **good contributors stop participating**

From real participation experience, this lack of trust is the **biggest flaw** in OSS events.

---

## 🎯 Our Goal

Create a system that:

- Ensures **fair opportunity** for every contributor
- Removes **manual bias** from PR scoring
- Works across **any tech stack / repo structure**
- Scales to **hundreds of contributors**
- Requires **minimal effort from project admins**
- Is **transparent, auditable, and deterministic**

---

## 🧠 Key Design Decisions (Brainstorming Summary)

### ❌ What we rejected
- Manual review committees (not scalable)
- Polling GitHub APIs every few hours (inefficient)
- Asking project admins to do extra work
- Relying on file structure assumptions (`src/`, `db/`, etc.)

### ✅ What we chose
- **GitHub App** (event-driven, scalable)
- **Webhook-based ingestion**
- **Async processing with queues**
- **Idempotent scoring**
- **Eventual consistency over real-time scoring**
- **Free-tier friendly infrastructure (with mitigations)**

---

## 🏗️ System Architecture

### High-Level Flow

```

Contributor → Pull Request → Merge
|
v
GitHub Webhook (PR merged)
|
v
ECWoC Sentinel Webhook API
|
v
Redis Queue (BullMQ)
|
v
PR Scorer Worker
|
v
MongoDB (Scores & Leaderboard)

````

---

### Detailed Flow (Step-by-Step)

1. **Project admin installs the GitHub App** on their repository
2. Contributor opens & merges a PR
3. GitHub sends a **`pull_request.closed` (merged)** webhook
4. Backend:
   - verifies webhook signature
   - immediately responds `200 OK`
   - pushes PR into a queue
5. Worker:
   - fetches PR metadata + changed files
   - computes objective signals
   - assigns a score (L1 / L2 / L3)
6. Score is stored against the contributor
7. Leaderboard updates automatically

---

## ⚖️ How Fairness Is Enforced

### Rule-Based (No AI, No ML)

Scoring is **deterministic and auditable**, based on:
- Lines changed
- Files touched
- Nature of changes (tests, logic, config)
- PR metadata

> No machine learning, no opaque decisions, no hidden weights.

### Idempotency Guarantee

- Each PR is scored **exactly once**
- Duplicate webhooks or retries **cannot inflate scores**
- Ensures correctness even under retries or restarts

---

## 🧰 Tech Stack

### Backend
- **Node.js**
- **Express.js**
- **BullMQ** (job queue)
- **Redis** (queue storage)
- **MongoDB Atlas** (persistent data)

### Infrastructure
- **GitHub App + Webhooks**
- **Render (Free tier)**
- **UptimeRobot** (keep-alive mitigation)

---

## ☁️ Deployment Strategy (Reality-Aware)

### Why Render?
- Free
- Simple
- HTTPS by default
- Webhook-friendly

### Known Limitation
Render free services **sleep after inactivity**.

### Mitigations Applied ✅

1. **GitHub Webhook Retries**  
   GitHub automatically retries failed deliveries.

2. **Fast Webhook Acknowledgement**  
   Webhook returns `200 OK` immediately.

3. **Async Queue Processing**  
   Heavy work never blocks webhooks.

4. **Idempotent DB Logic**  
   Prevents duplicate scoring.

5. **External Redis Queue**  
   Jobs persist across restarts.

6. **Health Keep-Alive Endpoint**
   ```http
   GET /health → 200 OK
````

Pinged every 5 minutes via UptimeRobot to prevent sleep.

> Result: Render behaves effectively as an always-on service for this use case.

---

## 🔐 Security & Privacy

* Only **public GitHub data** is accessed
* No write permissions on repositories
* No personal data beyond GitHub usernames
* No tokens stored in database
* No AI or automated decision-making affecting user rights

---

## 🧪 Testing Strategy

* Local testing with ngrok
* Production testing with:

  * real PR creation
  * merge events
  * webhook delivery verification
  * queue processing
  * leaderboard validation

---

## 📦 Environment Variables

```env
PORT=10000
MONGO_URI=...
REDIS_URL=redis://...
GITHUB_APP_ID=...
GITHUB_WEBHOOK_SECRET=...
GITHUB_PRIVATE_KEY=...
```

> Private key is stored as a single-line env variable (escaped `\n`).

---

## 📊 API Endpoints (Sample)

* `POST /api/webhook/github` – GitHub webhook
* `GET /api/leaderboard` – Contributor rankings
* `GET /api/prs` – Scored PRs
* `GET /health` – Keep-alive & monitoring

---

## 🧭 Why This Scales

* Event-driven (no polling)
* Queue-based processing
* Stateless web layer
* Retry-safe by design
* Independent of repo language or structure

---

## 🚀 Future Extensions

* Admin override dashboard
* Configurable scoring rules
* Per-event weight tuning
* Frontend dashboard
* Audit logs per PR

---

## 🏁 Final Note

ECWoC Sentinel is not a hacky script.
It is a **real system**, built with:

* honest constraints
* clear trade-offs
* scalable design
* and fairness at its core

It proves that **open-source events can be both large-scale and fair**.

---

### Maintained by

**ECWoC Core Team**

For questions, discussions, or improvements:
👉 Open an issue or discussion in this repository.



Just tell me.
```
