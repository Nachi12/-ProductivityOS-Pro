# ProductivityOS Pro — Enterprise MERN Personal Finance SaaS

> A production-ready, multi-user personal finance and bank statement analysis platform built with TypeScript, Node.js, Express, MongoDB, and React/ES Modules. Features integer minor unit (paise) money handling, idempotent statement parsing, SHA-256 duplicate transaction prevention, and layered architecture.

---

## Technical Highlights & Architecture

- **Layered Backend Architecture**: Clean separation into `Routes` → `Controllers` → `Services` → `Mongoose Models`.
- **Exact Monetary Calculation**: Stores all monetary values internally as integer minor units (`paise`) to prevent floating-point representation & rounding drift. Formatted using the **Indian Numbering System** (`₹10,00,000.00`).
- **Idempotent Bank Statement Pipeline**: Extensible strategy parser engine (CSV/PDF) that generates SHA-256 transaction fingerprints (`sha256(userId + date + amount + description + refNo)`), detects duplicate uploads, supports batch importing, and implements safe cascade statement deletion.
- **Multi-User Data Isolation & Anti-IDOR Protection**: Strict session/token authentication enforcement on every REST API endpoint guaranteeing zero cross-tenant data leaks.
- **Security & Reliability**: Helmet HTTP security headers, CORS protection, rate limiting (`express-rate-limit`), Zod schema request validation, and centralized error handling.
- **Comprehensive Automated Testing**: Full test suite built withVitest/Jest covering money utilities, loan EMI calculations, statement parsing, and fingerprint generation.

---

## Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Language** | TypeScript (ES2022) / JavaScript |
| **Backend Framework** | Node.js, Express.js |
| **Database & ORM** | MongoDB, Mongoose |
| **Security & Auth** | JWT, Bcrypt, Helmet, Express Rate Limit, Firebase Admin |
| **Validation** | Zod Schema Validator |
| **Testing** | Vitest / Jest / Tsx Automated Suite |
| **Documentation & CI/CD** | OpenAPI 3.0, GitHub Actions Workflow |

---

## System Architecture

```
[ Frontend Client ] ──(REST / HTTPS)──> [ Express REST API v1 ]
                                                  │
             ┌────────────────────────────────────┴────────────────────────────────────┐
             ▼                                    ▼                                    ▼
    [ Auth Middleware ]                 [ Controllers Layer ]               [ Security & Headers ]
    (JWT / Token Check)                 (Auth, Transaction,                 (Helmet / RateLimit)
                                         Statement, Analytics)
                                                  │
                                                  ▼
                                         [ Services Layer ]
                                         (Finance, Statement,
                                          Parsers Strategy)
                                                  │
                                                  ▼
                                      [ MongoDB Domain Models ]
                                      (User, Transaction, Loan,
                                       BankStatement, ImportBatch)
```

---

## REST API Specification

Detailed OpenAPI 3.0 specification available in [`docs/openapi.json`](docs/openapi.json).

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health check | No |
| `POST` | `/api/v1/auth/register` | Register user account | No (Rate limited) |
| `POST` | `/api/v1/auth/login` | Authenticate user & issue JWT | No (Rate limited) |
| `GET` | `/api/v1/transactions` | List paginated transactions (filter, search) | Yes |
| `POST` | `/api/v1/transactions` | Create manual income/expense entry | Yes |
| `POST` | `/api/v1/statements/upload` | Upload & parse bank statement | Yes |
| `POST` | `/api/v1/statements/:id/import` | Import confirmed statement transactions | Yes |
| `DELETE` | `/api/v1/statements/:id` | Cascade delete statement & batch transactions | Yes |
| `GET` | `/api/v1/analytics/summary` | Get financial summary (Net cash flow, EMI, savings rate) | Yes |

---

## Local Installation & Setup Guide

### Prerequisites
- **Node.js**: v20+
- **MongoDB**: Local instance running on `mongodb://127.0.0.1:27017` or MongoDB Atlas URI

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Nachi12/-ProductivityOS-Pro.git
cd -ProductivityOS-Pro
npm install --legacy-peer-deps
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 3. Run Automated Tests
```bash
npm test
```

### 4. Build TypeScript Server
```bash
npm run build
```

### 5. Start Development Server
```bash
npm start
```
The server will run on **`http://localhost:3000`**.

---

## License

ISC License. Built as an engineering project demonstrating Full Stack MERN development.
