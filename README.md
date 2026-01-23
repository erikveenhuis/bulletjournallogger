# Bullet Journal Logger

Daily metrics journaling with customizable questions, insights, and optional web-push reminders. Built on Next.js App Router + Supabase, with an admin console for managing question templates and users.

## Purpose

- Capture daily answers to a personalized set of questions.
- Visualize trends and download a CSV export.
- Send web-push reminders based on user timezone and reminder time.
- Provide an admin panel to manage templates, categories, answer types, and user access.

## Architecture Overview

- **Frontend (App Router)**: Pages in `app/(site)` for journal entry, insights, and profile management. Authentication lives in `app/(auth)` with Supabase password auth.
- **Admin UI**: Pages in `app/admin` for managing categories, answer types, question templates, users, and push subscriptions.
- **API Routes**: Server-side logic under `app/api` for answers, profile settings, question templates, admin actions, CSV export, and cron push.
- **Supabase**:
  - SSR client in `lib/supabase/server.ts`, browser client in `lib/supabase/client.ts`.
  - Admin client in `lib/supabase/admin.ts` for privileged admin routes and impersonation.
- **Push Notifications**:
  - Client-side subscription management in `lib/push-subscription.ts`.
  - Service worker in `public/sw.js`.
  - Cron endpoint `app/api/cron/route.ts` sends reminders using `web-push`.

### Core Data Model (Supabase)

Key tables used by the app (names inferred from queries):

- `profiles`: user settings (timezone, reminder_time, push_opt_in, is_admin, chart palette/style).
- `categories`: question grouping.
- `answer_types`: answer type definitions (boolean, number, text, single_choice, multi_choice).
- `question_templates`: canonical question definitions for all users.
- `user_questions`: per-user selection/order/customization of templates.
- `answers`: daily answers tied to templates and dates.
- `push_subscriptions`: browser push endpoints and keys per user.

Supabase migrations live in `supabase/migrations`.

## Setup

### Prerequisites

- Node.js `>=20.9.0`
- npm `>=10.0.0`
- A Supabase project (database + auth)

### Install

```bash
npm install
```

### Configure Environment

Create a `.env.local` with the following values:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# App URLs
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...

# Cron protection
CRON_SECRET=...
```

Notes:
- `NEXT_PUBLIC_*` variables are required on the client (sign-in/sign-up and push subscription).
- `SUPABASE_SERVICE_ROLE_KEY` is required for admin routes and impersonation.
- VAPID keys are required for web-push reminders and subscription setup.
- `CRON_SECRET` protects the push reminder endpoint.

### Database

Apply Supabase migrations from `supabase/migrations` to your project. If you use the Supabase CLI, the typical flow is:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

If you are working in Cursor, you can also use the Supabase MCP server to inspect schemas, run queries, or apply migrations without leaving the editor.

## Common Development Tasks

```bash
# Run the dev server
npm run dev

# Build for production
npm run build

# Start the production server
npm run start

# Lint
npm run lint
```

### Send Test Push Reminders (Cron)

The cron endpoint expects a Bearer token matching `CRON_SECRET`:

```bash
curl -X POST "http://localhost:3000/api/cron" \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Configuration Options

### Authentication

Supabase email/password auth is used from the sign-in and sign-up pages in `app/(auth)`.

### Push Notifications

- Client subscription logic: `lib/push-subscription.ts`
- Service worker: `public/sw.js`
- Reminder sending: `app/api/cron/route.ts`

Users opt in via profile settings (`push_opt_in`), and reminders are sent based on each user’s timezone and reminder time.

### Admin Features

Admins can:

- Manage categories, answer types, and question templates.
- Manage user admin status.
- Inspect and remove push subscriptions.
- Impersonate users for support and debugging.

Admin actions are protected by `profiles.is_admin`.

## Project Structure (High-Level)

- `app/(site)`: Main user experience (journal, insights, profile).
- `app/(auth)`: Sign-in and sign-up.
- `app/admin`: Admin console and tools.
- `app/api`: Server routes (data, admin, cron, push, export).
- `components`: Shared UI components, header/nav, push manager.
- `lib`: Supabase clients, auth helpers, types, push utilities.
- `public`: PWA assets and service worker.
- `supabase/migrations`: SQL migrations for schema.

## Deployment Notes

- Make sure all environment variables are configured in your hosting provider.
- `CRON_SECRET` should be set securely and used by your scheduler when calling `/api/cron`.
- For push reminders, your deployment must expose HTTPS and serve the service worker at `/sw.js`.
