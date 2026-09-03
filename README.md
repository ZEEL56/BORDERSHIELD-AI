# BorderShield AI

**AI-Powered Identity & Document Screening for Secure Borders**

Built for **Smart India Hackathon 2026** — Problem Statement **26188**: *AI-Based Fake
Identity & Document Screening System*, for the Ministry of Home Affairs, Sashastra
Seema Bal (SSB), Police II Division.

---

## 1. Problem Statement

Border-security personnel need to rapidly screen travel and identity documents for
forgery, tampering, and identity mismatch, and cross-reference travelers against
watchlists — while producing a defensible, tamper-evident record of every decision.

## 2. Solution

BorderShield AI is a full-stack screening platform that runs an uploaded document
through six pipeline stages — OCR extraction, structural/logical validation, AI
forensic tampering analysis, face verification, watchlist screening, and an
explainable deterministic risk score — and gives the officer a single recommendation
with the reasoning behind it, backed by a cryptographically hash-chained audit trail.

**This is a working prototype, not a production government system.** No component
claims to be a certified biometric matcher, a trained tampering-detection model, or a
connection to any real government database — every module that isn't is labeled as
such in the UI (see §11).

## 3. Architecture

```
Next.js App Router (React + TypeScript, Tailwind)
        ↓
Next.js Route Handlers (REST API, src/app/api/**)
        ↓
Prisma ORM  →  PostgreSQL
        ↓
Service layer (src/services/*) — OCR, Validation, Tampering, Face, Watchlist, Risk
        ↓
Security layer — JWT auth, bcrypt, role-based access, upload validation
        ↓
Immutable audit layer — SHA-256 hash-chained event log (src/lib/audit.ts)
```

Frontend, backend, database, forensic services, and audit layer are all wired
end-to-end; there are no hardcoded dashboard numbers or fake API responses — every
figure shown in the UI comes from a real database query.

## 4. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Recharts, Lucide icons |
| Backend | Next.js Route Handlers (REST) |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT (jsonwebtoken) + bcryptjs, httpOnly cookies, role-based access (ADMIN/OFFICER/ANALYST) |
| OCR | Tesseract.js |
| Image forensics | Jimp (pixel/pixel manipulation), ExifReader (EXIF metadata) |
| Reports | jsPDF + jspdf-autotable (client-generated PDF) |
| Tests | Custom lightweight runner via `tsx` (no DB required) |

## 5. AI / Forensic Pipeline

All five modules live in `src/services/` behind small, swappable interfaces — each
takes simple inputs (a file path, or the outputs of an earlier stage) and returns a
plain result object, so any module can be replaced with a trained ML service later
without touching the callers.

### 5.1 OCR (`ocr.service.ts`)
Runs Tesseract.js against the uploaded image, then parses document-type-specific
fields (Passport: name, passport number, nationality, DOB, expiry, gender; Visa:
visa number, type, entry validity, stay duration; National ID / Driving License /
Permit: generic identity fields) via MRZ- and label-pattern heuristics. Every field
carries a `{ field, value, confidence }` triple. Manual correction is expected via
officer review in the case UI (fields are editable data, not baked into the record
until the officer clears the case).

### 5.2 Document Validation (`validation.service.ts`)
Real, deterministic checks — not a model:
- **Structural** — required fields present, document-number format
- **Logical** — DOB precedes expiry, DOB not in the future
- **Expiration** — expired / expiring-soon / valid, with days remaining
- **Consistency** — name token count, gender-code sanity

Each check returns `pass | warn | fail` with a human-readable message.

### 5.3 Tampering Detection — the core module (`tampering.service.ts`)
**Method: Forensic / Heuristic Analysis** — classical image forensics, explicitly
*not* a trained/certified ML model (the codebase is structured so one can be dropped
in later behind the same `analyzeTampering()` function signature):

- **Error Level Analysis (ELA)** — re-compresses the image at a fixed JPEG quality
  and measures the per-block pixel-difference residue; region blocks whose residue
  is a statistical outlier (mean + 1.75σ) are flagged as suspicious regions.
- **Noise-consistency analysis** — computes local grayscale variance per block;
  abnormally smooth blocks relative to the image's overall noise floor suggest
  cloning/smoothing.
- **Compression-artifact consistency** — variance of the ELA residue itself, as a
  proxy for double-compression / mixed-quality regions.
- **EXIF metadata analysis** (via ExifReader) — flags known editing-software
  signatures (Photoshop, GIMP, etc.), DateTime vs DateTimeOriginal mismatches, and
  absence of EXIF data entirely.

Output is the structured JSON specified in the brief: `tamperingDetected`,
`confidence`, `indicators[]`, `suspiciousRegions[]`, `metadataAnalysis`,
`explanation`. Confidence is a weighted combination of the four signals above.

### 5.4 Face Verification (`face.service.ts`)
**Method: Heuristic Visual Similarity Analysis** — a YCbCr skin-tone region
detector finds the largest face-like region in both the document photo and the
presented-person photo, crops and normalizes them, and computes a grayscale
pixel-correlation similarity score. This is explicitly **not** biometric-grade face
recognition (no facial-landmark or embedding model such as InsightFace / FaceNet /
ArcFace is used) — it is labeled as such everywhere it's shown. Handles no-face,
multiple-faces, and low-confidence cases explicitly rather than guessing.

### 5.5 Watchlist (`watchlist.service.ts`)
Checks the case's extracted name/document number against a `WatchlistEntry` table
seeded with **clearly labeled demo records** — exact document-number match, or
Jaccard token-similarity on name (≥0.8 → match, ≥0.4 → review required). The UI
labels this "DEMO WATCHLIST DATABASE" everywhere it appears; it is a local table,
not a connection to any government or law-enforcement system.

### 5.6 Explainable Risk Engine (`risk.service.ts`)
A deterministic, additive point system combining watchlist result, tampering
confidence, face-match outcome, validation failures/warnings, expiry status, OCR
confidence, and metadata anomalies into a 0–100 score, banded LOW (0–29) / MEDIUM
(30–59) / HIGH (60–79) / CRITICAL (80–100). Every point is attributed to a factor
with a plain-English reason, and the response includes a recommendation string
(e.g. "SECONDARY INSPECTION REQUIRED").

## 6. Immutable Audit Trail

`src/lib/audit.ts` implements a SHA-256 hash chain: every recorded event's hash is
`SHA256(previousHash + eventType + JSON(eventData) + timestamp)`. Because each
hash depends on the one before it, editing or deleting any historical row changes
that row's recomputed hash and breaks every hash after it — `POST /api/audit/verify`
walks the entire chain and reports `INTEGRITY VIOLATION DETECTED` at the first break.
This is a from-scratch cryptographic chain (Node's built-in `crypto` module), not a
blockchain network — the architecture (append-only hash-linked log with a public
verification function) is intentionally the same shape as a private ledger, and is
structured so a real chain (e.g. Hyperledger Fabric, or anchoring digests to a public
chain) could sit behind the same `recordAuditEvent()` / `verifyChain()` interface
without changing any caller.

## 7. Database Schema

PostgreSQL via Prisma (`prisma/schema.prisma`): `User`, `ScreeningCase`, `Document`,
`OCRResult`, `ValidationResult`, `TamperingResult`, `FaceVerification`,
`WatchlistEntry`, `WatchlistCheck`, `RiskAssessment`, `Decision`, `AuditLog`,
`SystemConfig` — with foreign keys, indexes, and timestamps throughout.

## 8. Security

- Passwords hashed with bcrypt (cost factor 12)
- JWT session tokens in httpOnly, sameSite cookies (8h expiry)
- Role-based authorization (ADMIN / OFFICER / ANALYST) enforced server-side on every
  privileged route, not just hidden in the UI
- Upload validation: MIME allowlist, extension allowlist, **magic-byte signature
  check** (rejects files whose content doesn't match a real JPEG/PNG/WEBP header),
  10MB size cap, random server-generated filenames (no path traversal via
  user-supplied names)
- All Prisma queries are parameterized (no raw SQL string interpolation → no SQL
  injection surface)
- React's default JSX escaping is relied on throughout (no `dangerouslySetInnerHTML`
  anywhere in the app) → no XSS from stored OCR/user text
- Errors are logged server-side and returned to the client as generic messages —
  stack traces and internals are never leaked to the browser
- `ANALYSIS UNAVAILABLE` is returned (not a false "clear") if the forensic service
  throws, so a service outage can never silently look like a clean document

## 9. Getting Started

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local or hosted)

### Setup

```bash
npm install
cp .env.example .env     # edit DATABASE_URL / JWT_SECRET if needed
npx prisma db push       # creates the schema in your database
npm run db:seed          # demo accounts + demo watchlist + 5 demo scenarios
npm run dev               # http://localhost:3000
```

> **Note on this repository's build sandbox:** this project was authored in an
> environment whose outbound network is restricted to package registries
> (npm/GitHub/apt) and does **not** include `binaries.prisma.sh`, which is where
> Prisma's CLI downloads its query/schema engine binaries from on first
> `prisma generate`. Because of that, `prisma generate` (and therefore the full
> `npm run build`, which calls it) could not be executed to completion inside that
> sandbox — `next build` was run directly instead, which reported
> **`✓ Compiled successfully`** with zero TypeScript errors across every page and
> API route; the only failure was Prisma's own client throwing "not initialized" when
> a route handler was probed at build time, which is exactly what's expected without
> a generated client, and not a code defect. On a normal machine or CI runner with
> standard internet access, `npx prisma generate` (or `npm run build`, which runs it
> automatically) will succeed on the first try.

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@bordershield.gov.in | Admin@12345 |
| Officer | officer@bordershield.gov.in | Officer@12345 |
| Analyst | analyst@bordershield.gov.in | Analyst@12345 |

### Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Signing secret for session tokens — change this in any real deployment |
| `NODE_ENV` | `development` / `production` |
| `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_APP_SUBTITLE` | Branding strings |

## 10. Role-Specific Experience

Each of the three roles lands on a genuinely different page after login and sees a
different sidebar — none of them is a copy of another:

- **Officer** → `/dashboard` ("Screening Operations"): today's screening count,
  active screenings, pending-decision queue (with a direct link into it), high-risk
  and critical-alert counts, and the full **New Screening** pipeline. This is the
  operational, one-case-at-a-time role.
- **Analyst** → `/analyst` ("Intelligence & Investigation"): an investigation queue
  of high/critical-risk cases still awaiting a decision, a chart of the most
  recurring tampering indicators across all flagged cases, a risk-score trend line,
  repeated-identifier detection (the same name or document number appearing across
  multiple distinct cases — a real cross-case pattern query, not a mock list),
  recent watchlist activity, and country trends. This is the cross-case, after-the-
  fact pattern-finding role, backed by `/api/analytics/intelligence`.
- **Admin** → `/admin` ("Admin Overview"): system-wide screening stats, audit-chain
  integrity status, service health for every pipeline stage, and full user/role
  management (create, disable/enable, change role) — the system-administration role.
  Admin's sidebar also keeps links into Screening Ops, Intelligence, and New
  Screening, since an admin may need to step into either operational view.

All three roles share **Cases**, **Watchlist**, **Audit Trail**, and **Settings** —
those aren't role-specific data, so duplicating them per role would just be noise.
Server-side role checks (`requireRole()`) protect the underlying admin/analyst API
data regardless of which page the browser is on; the pages themselves show a plain
"you don't have permission" message if a role check fails, rather than silently
looking broken.

## 11. Demo Flow

1. Sign in as `officer@bordershield.gov.in`
2. **New Screening** → choose a document type, upload a document image (and
   optionally a "presented person" photo for face verification) → **Run Screening
   Pipeline**
3. Watch the pipeline stages execute in order (OCR → Validation → Tampering →
   Face → Watchlist → Risk)
4. Land on the case page: identity fields, validation checks, forensic findings with
   confidence scores, face-match result, watchlist result, and the explainable risk
   score with its point-by-point breakdown
5. Record an officer decision (Clear / Secondary Inspection / Reject / Refer to
   Investigation) with a required reason
6. **Download Report** → a PDF report is generated client-side (jsPDF) with the full
   case record and its latest audit hash
7. Visit **Audit Trail** → select the case → see its hash-chained event log →
   **Verify Full Chain** to cryptographically confirm nothing has been altered

The seed script also populates five pre-built, clearly labeled demo cases
(`BSC-DEMO-0001`–`0005`) covering: a genuine low-risk document, a tampered
critical-risk document, a face-mismatch high-risk case, an expired-visa case, and a
watchlist-match case — so **Cases**, **Dashboard**, and **Analytics** have realistic
data immediately after seeding, without running the live pipeline first.

## 12. API Documentation

All routes require an authenticated session (httpOnly cookie set by
`/api/auth/login`) except `/api/auth/login` itself.

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Authenticate, sets session cookie |
| POST | `/api/auth/logout` | Clears session cookie |
| GET | `/api/auth/me` | Current user |
| POST | `/api/documents/upload` | Upload a document/selfie image to a case |
| POST | `/api/ocr/process` | Run OCR on a document |
| POST | `/api/validation/check` | Run structural/logical/expiry/consistency checks |
| POST | `/api/tampering/analyze` | Run forensic tampering analysis |
| POST | `/api/face/verify` | Compare document photo vs. presented-person photo |
| POST | `/api/watchlist/check` | Check name/doc number against the demo watchlist |
| GET/POST | `/api/watchlist/entries` | List / add demo watchlist entries |
| GET | `/api/watchlist/search` | Ad-hoc manual watchlist search |
| POST | `/api/risk/calculate` | Compute the explainable risk score for a case |
| POST | `/api/screening/run` | **End-to-end orchestrator** — upload + all six stages in one call |
| GET | `/api/screening/:id`, `/api/cases/:id` | Full case detail |
| GET | `/api/cases` | List cases (search, status filter, pagination) |
| POST | `/api/cases/:id/decision` | Record the officer's final decision |
| GET | `/api/audit/:caseId` | Audit event chain for a case |
| POST | `/api/audit/verify` | Recompute and verify the full hash chain |
| GET | `/api/dashboard/stats` | Aggregate dashboard/analytics data (also powers Officer/Admin operational counts) |
| GET | `/api/analytics/intelligence` | Analyst/Admin-only: investigation queue, tampering-indicator frequency, repeated identifiers, watchlist activity, trends |
| GET/POST | `/api/admin/users` | List / create users (admin only) |
| PATCH | `/api/admin/users/:id` | Update role / active status (admin only) |
| GET | `/api/admin/system` | Service health + audit-chain status (admin only) |
| GET | `/api/reports/:id` | Structured report data for client-side PDF export |

## 13. Testing

```bash
npm test
```

Runs a dependency-free suite (via `tsx`, no database needed) against the pure-logic
modules: document validation rules, the risk-scoring engine's factor weighting and
clamping, and the audit hash chain's determinism and tamper-sensitivity. For
end-to-end / integration testing of the full pipeline, run `npm run dev` against a
seeded database and exercise the flow in §10, or call the REST endpoints in §11
directly.

## 14. Limitations

- Tampering detection and face verification are **heuristic/classical** methods,
  not trained ML models — they are appropriate for a hackathon demo and are
  architected to be swappable for real models, but should not be represented as
  production-grade forensic or biometric systems.
- The watchlist is a small local demo table, not a live government feed.
- OCR field parsing uses layout/regex heuristics tuned to common passport/visa/ID
  formats; it will need broader pattern coverage for the full diversity of real-world
  documents.
- No real-time video liveness detection — face verification works on a single
  presented-person photo.

## 15. Future Scope

- Swap `TamperingDetectionService` and `FaceVerificationService` for trained models
  (both already isolated behind stable function signatures for this purpose)
- Real government watchlist / database integration via an authorized API, once
  available, behind the same `checkWatchlist()` interface
- Anchor the audit hash chain to Hyperledger Fabric or another distributed ledger
  for cross-organization verifiability
- Multi-document cross-referencing within a single case (e.g. passport + visa
  consistency checks against each other)

---

*BorderShield AI is a Smart India Hackathon prototype. It does not claim, and is
not, integration with any real SSB, MHA, immigration, or government biometric
system.*
