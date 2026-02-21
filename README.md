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
PR merged
  ↓
Webhook received
  ↓
Job queued
  ↓
Worker starts
  ↓
Fetch PR + files
  ↓
Run scorer
  ↓
Apply ECWoC26-Lx label
  ↓
Save score in DB
  ↓
Update contributor
  ↓
Job completed

```

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

```

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

## 📏 Scoring Metrics, Levels & Time Windows

Once a PR passes the event gates (has the event label and is merged), it is scored purely based on objective signals from the PR payload and its changed files.

### 1. Metrics Used

- **Hard gate: docs‑only PRs**
  - If **every changed file** ends with `.md`, the PR is treated as **docs‑only**.
  - Docs‑only PRs are always mapped to:
    - **Score:** `10`
    - **Level:** `L1`
    - **Event points:** `3`
    - Reason: "Docs-only PR (capped at L1)".
  - The remaining metrics below apply only to PRs that are **not** docs‑only.

- **Effort: lines of code changed (additions + deletions)**
  - `> 150` LOC → **+30** points, reason: "High effort change (>150 LOC)"
  - `40–150` LOC → **+20** points, reason: "Moderate effort change (40–150 LOC)"
  - `< 40` LOC → **+10** points, reason: "Low effort change (<40 LOC)"

- **Breadth: number of files changed**
  - `≥ 5` files → **+20** points, reason: "Broad change across multiple files (5+)"
  - `2–4` files → **+10** points, reason: "Multi-file change"
  - `1` file → **+0** extra points from this metric

- **Anti‑spam: change density**
  - Density is computed as: `density = (additions + deletions) / max(files_changed, 1)`.
  - `density < 5` → **−15** points, reason: "Low change density (many files, tiny changes)"
  - `density > 20` → **+10** points, reason: "High change density (substantial work per file)"

- **Feature signal: new files added**
  - Count of files with status `added`.
  - `≥ 2` new files → **+10** points, reason: "Introduces new files (feature-level change)".

- **Quality signal: meaningful tests**
  - If **any changed file name** matches `/test|spec/i` **and** that file has `≥ 10` additions → **+10** points, reason: "Includes meaningful test coverage".

The final **raw score** for a non-docs PR is the sum of all the above contributions, and every individual reason is stored for transparency.

### 2. Mapping Score → Level & Event Points

After computing the raw score, it is mapped to a **difficulty level** and **event points** as follows:

- **Level L3**
  - Condition: `score ≥ 50`
  - Event points: **10**

- **Level L2**
  - Condition: `30 ≤ score < 50`
  - Event points: **7**

- **Level L1**
  - Condition: `score < 30`
  - Event points: **3**

There is currently **no separate "Level 0"** once a PR reaches the scoring stage; if it passes the event label + merged gates, it will receive at least **L1** with the corresponding points, even if heavily penalized (e.g., docs‑only PRs).

---

### 3. Finale Bonus Multiplier Window

To reward active contributors near the end of the event, ECWoC Sentinel applies a **contributor‑points‑based multiplier** only within a fixed **finale bonus window**.

**Bonus window (UTC):**

- Start: **2026‑02‑22 12:00:00 UTC**
- End: **2026‑02‑28 23:59:59 UTC**

For PRs scored **inside** this window, the base event points (3 / 7 / 10) are multiplied by a tier derived from the contributor’s **lifetime total points**:

- Tier 1: `0–500` points → **2.0x**
- Tier 2: `501–1000` points → **1.75x**
- Tier 3: `1001–2000` points → **1.5x**
- Tier 4: `2001–4000` points → **1.25x**
- Tier 5: `4000+` points → **1.1x**

Outside this window, the effective multiplier is **1.0** (no bonus), so event points are exactly `3 / 7 / 10` depending on L1 / L2 / L3.

PRs that receive the finale bonus are labeled accordingly on GitHub, for example:

- `ECWoC26-L1-FINALE-BONUS`
- `ECWoC26-L2-FINALE-BONUS`
- `ECWoC26-L3-FINALE-BONUS`

PRs scored outside the bonus window keep the existing labels:

- `ECWoC26-L1`, `ECWoC26-L2`, `ECWoC26-L3`.

Internally, each scored PR also stores a flag indicating whether the finale bonus was applied, making the effect **auditable**.

---

### 4. Event End Cutoff (No Scoring After Event)

The ECWoC event has a hard **end cutoff**; PRs created after this moment are **recorded but never scored**.

**Event end (UTC):**

- Cutoff: **2026‑03‑01 00:00:00 UTC**

Behavior for PRs **created on or after** this timestamp:

- The PR is still fetched and stored in MongoDB for historical records.
- It is marked with:
  - `score: 0`
  - `level: "ENDED"`
  - `points: 0`
  - reason: _"Event period has ended; PR not eligible for scoring"_
- On GitHub, a label like **`ECWoC26-ENDED`** is applied (best‑effort) to clearly indicate that the PR is outside the event window.
- No contributor totals are incremented; the contributor receives **no points** for such PRs.

This ensures that:

- **All PRs are tracked**, even those after the event.
- **No one can game the system** by sending new PRs after the official end.

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
   ```

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
````
