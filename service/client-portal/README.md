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

1. Copy `.env.example` to `.env`.
2. Fill in the values from the [Environment variables](#environment-variables) table.

Never commit `.env`.

### Install

- `npm install`

### Run

- `npm run dev`: dev server, restarts on changes in `src/` (nodemon)
- `npm start`: start the server once, no file watching

### Test

- `npm test`: full test suite (uses `.env.test`; needs a migrated `_test` database, see `db:test:migrate`)

### Database

- `npm run db:migrate`: create and apply a migration
- `npm run db:generate`: regenerate the Prisma client
- `npm run db:test:migrate`: apply migrations to the test database

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

| Variable       | Required | Default | Description                                                  |
| -------------- | -------- | ------- | ------------------------------------------------------------ |
| `PORT`         | Yes      |         | Port the server listens on (1-65535)                         |
| `NODE_ENV`     | Yes      |         | `development`, `production` or `test`                        |
| `DATABASE_URL` | Yes      |         | PostgreSQL connection URL. When `NODE_ENV=test`, the database name must end with `_test` |
| `JWT_SECRET`   | Yes      |         | Secret used to sign tokens. At least 32 characters           |
| `JWT_EXPIRES`  | No       | `1d`    | Token lifetime: seconds (`3600`) or a number with a unit `s`, `m`, `h` or `d` (`15m`, `1d`) |
| `LOG_LEVEL`    | No       | `info`  | `error`, `warn`, `info` or `debug`                           |
| `TRUST_PROXY`  | No       | `false` | `true`, `false`, or number of proxy hops (when behind a proxy) |
| `CORS_ORIGINS` | No       | (none)  | Comma-separated list of allowed browser origins              |

The server refuses to start if a required variable is missing or invalid.

Tests never touch the dev database: with `NODE_ENV=test` the app refuses to load unless the database name in `DATABASE_URL` ends with `_test`. Apply migrations to it with `npm run db:test:migrate`.

## Endpoints

Routes are versioned: `/api/v1/...`, admin routes `/api/v1/admin/...`. `/health` is not versioned.

### GET /health

Liveness check. No auth.

- Request: none
- Responses: `200 { "status": "ok" }`
- Errors: none
- Rules: unversioned on purpose, so load balancers and uptime checks keep working across API versions.

Unknown routes return `404 { "error": "Not found" }`.

Errors always have the shape `{ "error": "<message>" }`. A malformed JSON body returns `400 { "error": "Invalid JSON" }`.

### Auth: shared shapes

User object (the only way a user is ever returned; the password hash is never included):

```json
{
  "id": "uuid",
  "name": "Juan Dela Cruz",
  "mobile": "+639171234567",
  "email": "juan@example.com",
  "role": "client",
  "createdAt": "2026-11-19T06:14:45.000Z"
}
```

Tokens are JWTs (HS256) signed with `JWT_SECRET`, expiring after `JWT_EXPIRES`, with payload `{ sub: <user id>, role }` only. Send them as `Authorization: Bearer <token>`.

### POST /api/v1/auth/register

Creates a client account. No auth. Admins are never created here.

- Request body (JSON), all required: `name`, `mobile`, `email`, `password`. Any other field (`id`, `role`, ...) is ignored. The role is always `client`.
- Responses: `201 { "message": "Registration successful", "token": "<jwt>", "user": { ... } }`

Validation (control characters and null bytes are rejected in every field):

| Field    | Rule |
| -------- | ---- |
| name     | Trimmed, repeated inner spaces collapsed to one. 2 to 100 characters. Unicode letters, plus single spaces, apostrophes, hyphens and periods between letters. Must start with a letter. No digits, no two punctuation marks in a row. |
| email    | Trimmed and lowercased before storing. Max 254 characters, max 64 before the `@`. One `@`, a domain with at least one dot and a TLD of 2+ letters. No spaces, no consecutive dots, no leading or trailing dot in the local part or domain, no hyphen at the start or end of a domain label. |
| mobile   | Philippine mobile only. Spaces, dashes and parentheses are removed first. Accepted: `09XXXXXXXXX`, `+639XXXXXXXXX`, `639XXXXXXXXX`. Stored only as `+639XXXXXXXXX`. |
| password | Not trimmed. At least 8 characters and at most 72 **bytes** (the bcrypt limit; a multi-byte character uses more than one). Hashed with bcrypt, cost 10. |

| Status | Error message |
| ------ | ------------- |
| 400 | `Name, mobile, email and password are required` |
| 400 | `Invalid name` |
| 400 | `Invalid email format` |
| 400 | `Invalid mobile number` |
| 400 | `Password must be at least 8 characters` |
| 400 | `Password must be at most 72 bytes` |
| 400 | `Invalid password` (control character or null byte in the password) |
| 409 | `Email already registered` |
| 409 | `Mobile number already registered` |

Rules:

- Duplicates are checked after normalizing (`DAN@TEST.COM` = `dan@test.com`; `09171234567` = `+63 917 123 4567`), and again by the database unique constraints, so two parallel requests cannot both succeed.
- Validation order: required fields, name, email, mobile, password, then duplicates.

### POST /api/v1/auth/login

No auth.

- Request body (JSON), both required non-empty strings: `identifier` (an email or a Philippine mobile number, validated with the same rules as registration) and `password`.
- Responses: `200 { "message": "Login successful", "token": "<jwt>", "user": { ... } }`

| Status | Error message |
| ------ | ------------- |
| 400 | `Identifier and password are required` |
| 401 | `Invalid credentials` |

Rules:

- An unknown account, a wrong password, an identifier that is neither a valid email nor a valid mobile, and a password over 72 bytes all return the same `401 Invalid credentials`, so the response never reveals whether an account exists or which formats are accepted.
- A bcrypt comparison always runs (against a dummy hash when there is no account), so response time does not reveal which accounts exist.

### GET /api/v1/auth/me

Returns the logged-in user.

- Request: header `Authorization: Bearer <token>`. No body. The user is identified only by the token, never by the URL or body.
- Responses: `200 { "user": { ... } }`

| Status | Error message |
| ------ | ------------- |
| 401 | `Unauthorized` |

Rules:

- The same `401 Unauthorized` is returned for a missing or malformed header, an invalid or expired token, and a token whose user no longer exists. The user is re-read from the database on every request.

Each endpoint gets its own section with:

- Request
- Responses
- Error table (messages must match the code exactly)
- Rules
