# System Architecture Documentation

## Overview

ProductivityOS Pro is an enterprise-grade MERN personal financial management SaaS engineered with a 4-layer backend design, exact integer minor unit (paise) monetary handling, and an idempotent bank statement parsing pipeline.

---

## High-Level Architecture Diagram

```mermaid
graph TD
    Client["Frontend Client (React / Vanilla JS)"]
    API["Express.js REST API v1 (helmet, cors, rateLimiter)"]
    Auth["JWT / Firebase Auth Middleware"]
    Ctrl["Layered Controllers (Auth, Transaction, Statement, Analytics)"]
    Svc["Business Services (FinanceService, StatementService)"]
    MoneyUtils["Money Utilities (paise / Indian INR)"]
    Parsers["Parser Strategy (CSV, PDF) & Fingerprint Engine"]
    DB[("MongoDB Database (User, Transaction, BankStatement, Loan)")]

    Client -->|HTTPS / REST| API
    API --> Auth
    Auth --> Ctrl
    Ctrl --> Svc
    Svc --> MoneyUtils
    Svc --> Parsers
    Svc --> DB
```

---

## Bank Statement Processing Pipeline Diagram

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant API as Statement Controller
    participant Svc as Statement Service
    participant Parser as CSV / PDF Parser Strategy
    participant DB as MongoDB

    User->>API: POST /api/v1/statements/upload (fileContent)
    API->>Svc: processStatement(userId, fileContent)
    Svc->>Parser: parseContent(fileContent)
    Parser-->>Svc: rawTransactions + SHA-256 Fingerprints
    Svc->>DB: Find existing fingerprints for userId
    DB-->>Svc: existingFingerprints
    Svc-->>API: Parsed list + isDuplicate Flags
    API-->>User: Preview & Duplicate Review Payload
    User->>API: POST /api/v1/statements/:id/import (confirmedList)
    API->>Svc: importStatementTransactions(userId, statementId, confirmedList)
    Svc->>DB: Idempotent Batch Insert (ImportBatch + Transactions)
    DB-->>Svc: Success
    API-->>User: Updated Financial Analytics & Summary
```

---

## Database Schemas & Indexing Strategy

1. **User**: `{ uid: 1 }` (unique), `{ email: 1 }` (unique), `{ familyId: 1 }`.
2. **Transaction**: `{ userId: 1, date: -1 }`, `{ userId: 1, type: 1, date: -1 }`, `{ userId: 1, fingerprint: 1 }`.
3. **BankStatement**: `{ userId: 1, createdAt: -1 }`.
4. **Loan**: `{ userId: 1, status: 1 }`.
5. **ImportBatch**: `{ userId: 1, statementId: 1 }`.
