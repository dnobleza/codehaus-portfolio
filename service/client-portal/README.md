# client-portal

Backend API for the client portal: clients request website/app builds, and the portfolio showcases past work.
A fresh restart of the Codehaus client portal, built phase by phase.

## Tech stack

- Node.js 22.12+ (24 recommended), Express 5
- Plain JavaScript, CommonJS (`require` / `module.exports`)
- PostgreSQL, Prisma ORM (`@prisma/adapter-pg`) (TODO: confirm)
- Auth: JWT in the `Authorization: Bearer` header, bcryptjs for passwords (TODO: confirm)
- winston (logging), helmet, cors, express-rate-limit
- Tests: node:test + Supertest

## Getting started

Run everything from `service/client-portal`.

### Prerequisites

- Node.js 22.12+ (24 recommended)
- PostgreSQL (TODO: version)
- A separate test database (TODO: how to create it)

### Environment setup

1. Copy `.env.example` to `.env` (TODO: `.env.example` does not exist yet).
2. Fill in the values from the [Environment variables](#environment-variables) table.

Never commit `.env`.

### Install

TODO: `npm install` once dependencies are added to `package.json`.

### Run

- `npm run dev`: dev server (TODO: script not defined yet)

### Test

- `npm test`: full test suite (TODO: script is still the placeholder in `package.json`)

### Database

- `npm run db:migrate`: create and apply a migration (TODO: script not defined yet)
- `npm run db:generate`: regenerate the Prisma client (TODO: script not defined yet)

## Project structure

```
service/client-portal/
├── src/
│   ├── config/        env.js (reads and checks env variables), db.js (Prisma client)
│   ├── controllers/   read the request, call a service, send the response
│   ├── middleware/    requestLogger, notFound, errorHandler, requireAuth, requireRole, cors, rateLimiters
│   ├── models/        all database access (Prisma)
│   ├── routes/        map URLs to controllers
│   ├── services/      business rules (validation, duplicates, hashing, tokens)
│   ├── utils/         AppError, logger, validation, regex, token helpers
│   ├── app.js         builds the Express app (middleware order lives here)
│   └── server.js      starts the server
├── prisma/
│   ├── schema.prisma  database tables (single source of truth)
│   └── migrations/    versioned SQL, committed
├── scripts/           command-line scripts run by hand (e.g. seedAdmin.js), not part of the server
├── tests/             service/model tests; tests/http/ for Supertest HTTP tests
├── .env.example
└── package.json
```

Request flow: `route → controller → service → model`.

## Environment variables

| Variable | Required | Description |
| -------- | -------- | ----------- |
| TODO     | TODO     | TODO        |

## Endpoints

None yet. Routes are versioned: `/api/v1/...`, admin routes `/api/v1/admin/...`.

Each endpoint gets its own section with:

- Request
- Responses
- Error table (messages must match the code exactly)
- Rules
