# FinanceOS Pro — AI Financial Intelligence & Wealth Operating System

> A production-grade AI-Powered Personal Finance Platform & Wealth Operating System built with TypeScript, Node.js, Express, MongoDB, and ES Modules. Features server-side LLM provider abstraction (Google Gemini, OpenAI, Anthropic, DemoAIProvider), structured context engineering, prompt injection defense, 1-click Financial Diagnosis across 7 Life Stages, ₹1 Crore Wealth Path compounding calculator, and deterministic arithmetic calculation separation.

---

## 🚀 Key AI Architecture & Technical Highlights

### 1. Server-Side AI Provider Abstraction (`AIProvider`)
- Implemented `AIProvider` unified interface (`completion`, `structuredOutput`) in `src/services/ai/aiProvider.ts`.
- Supports switching between **Google Gemini 1.5 Flash REST API**, **OpenAI Chat Completions (`gpt-4o-mini`)**, and built-in **`DemoAIProvider`**.
- **Zero API Keys in Frontend**: All LLM API calls execute strictly server-side.

### 2. Financial Context Engine (`FinancialContextService`)
- Constructs normalized, summarized JSON context payloads (`summary`, `healthScore`, `topExpenses`, `loans`, `assets`, `netWorth`, `recentChanges`) to guarantee 100% data precision while minimizing token costs.

### 3. Deterministic Arithmetic + AI Interpretation Separation
- Core financial calculations (Savings Rate, Net Worth, EMI, Debt Payoff timelines, Health Score, ₹1 Crore compounding) are 100% computed programmatically by TypeScript services. AI interprets, diagnoses, prioritizes, and generates actionable advice without hallucinating arithmetic.

### 4. 1-Click Financial Diagnosis & 7 Financial Life Stages
- `AIDiagnosisService` classifies user status into:
  1. **Stage 1**: Financial Recovery (Negative cash flow / high DTI)
  2. **Stage 2**: Financial Stability (Basic surplus, building cash buffer)
  3. **Stage 3**: Financial Foundation (15%+ savings rate & emergency reserves)
  4. **Stage 4**: Wealth Building (Surplus cash flow & systematic capital growth)
  5. **Stage 5**: Accelerated Wealth Building (High financial efficiency)
  6. **Stage 6**: Financial Independence (Passive returns cover living expenses)
  7. **Stage 7**: High Net Worth Management (Estate planning & capital preservation)

### 5. Prompt Injection Defense & AI Security
- Sanitizes user input and bank statement transaction descriptions. Wraps financial data in system context delimiters (`<user_financial_data>`) to prevent uploaded text from overriding system instructions.

---

## Tech Stack

| Domain | Technology |
| :--- | :--- |
| **Language** | TypeScript (ES2022) / JavaScript |
| **Backend Framework** | Node.js, Express.js |
| **Database & ORM** | MongoDB, Mongoose |
| **AI Providers** | Google Gemini 1.5 Flash, OpenAI (`gpt-4o-mini`), DemoAIProvider |
| **Security & Auth** | JWT, Bcrypt, Helmet, Express Rate Limit, Firebase Admin |
| **Validation** | Zod Schema Validator |
| **Testing** | Vitest / Tsx Automated Test Runner |

---

## AI System Architecture

```
[ FRONTEND CLIENT ] ──(REST / HTTPS)──> [ EXPRESS REST API v1 ]
                                                    │
               ┌────────────────────────────────────┴────────────────────────────────────┐
               ▼                                    ▼                                    ▼
      [ Auth Middleware ]                 [ AI Controllers ]                   [ Security & Headers ]
      (JWT / X-User-UID)                  (Copilot, Diagnosis,                 (Helmet / RateLimit)
                                           WealthPath, Command)
                                                    │
                                                    ▼
                                      [ Financial Context Engine ]
                                      (Summarized Context Payload)
                                                    │
                                                    ▼
                                      [ Server-Side AI Provider ]
                                  (Gemini, OpenAI, DemoAIProvider)
```

---

## REST API Specification

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Service health check | No |
| `POST` | `/api/v1/auth/register` | Register user account | No (Rate limited) |
| `POST` | `/api/v1/auth/login` | Authenticate user & issue JWT | No (Rate limited) |
| `GET` | `/api/v1/transactions` | List paginated transactions | Yes |
| `POST` | `/api/v1/transactions` | Create manual income/expense entry | Yes |
| `POST` | `/api/v1/statements/upload` | Upload & parse bank statement | Yes |
| `GET` | `/api/v1/analytics/summary` | Financial summary & Health Score (0-100) | Yes |
| `POST` | `/api/v1/ai/copilot` | Natural language Financial Copilot Q&A | Yes |
| `POST` | `/api/v1/ai/diagnosis` | 1-Click Financial Diagnosis & 7 Life Stages | Yes |
| `POST` | `/api/v1/ai/wealth-path` | ₹1 Crore Wealth Path Calculator & AI Path | Yes |
| `POST` | `/api/v1/ai/command` | Natural language intent parser & filter | Yes |
| `GET` | `/api/v1/ai/insights` | Priority insights matrix (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`) | Yes |
| `GET` | `/api/v1/ai/action-plan` | Personalized 7/30/90-day financial action checklist | Yes |

---

## Setup & Configuration Guide

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

To configure Google Gemini (Free API Key):
```env
AI_PROVIDER=gemini
GEMINI_API_KEY=your_google_gemini_api_key_here
```

To configure OpenAI:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key_here
```

*(If no key is configured, the server automatically defaults to `DemoAIProvider` server-side).*

### 3. Run Automated Test Suite
```bash
npx tsx tests/runner.ts
```

### 4. Build & Start Application
```bash
npx tsc
node server.js
```
The server will run live on **`http://localhost:3000`**.

---

## License

ISC License. Built as an enterprise portfolio AI Financial Intelligence Platform.
