# EMP Rewards

> Recognize and reward top performers to boost morale and retention

[![Part of EmpCloud](https://img.shields.io/badge/EmpCloud-Module-blue)]()
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-purple.svg)](LICENSE)

EMP Rewards is the employee recognition and rewards module of the EmpCloud ecosystem. It provides peer-to-peer kudos, a points system, badges, a reward catalog with redemption workflows, leaderboards, nominations, and a social celebration feed.

---

## Features

| Feature | Description |
|---------|-------------|
| Peer Recognition / Kudos | Send kudos to colleagues with message, category, public/private visibility |
| Points System | Earn points for kudos, milestones, achievements; configurable values per org |
| Badges & Achievements | Milestone badges (tenure, kudos count, top performer), custom badges per org |
| Reward Catalog | Redeemable rewards (gift cards, extra PTO, swag, experiences), point-based pricing |
| Redemption & Fulfillment | Redeem points for rewards, approval workflow, fulfillment tracking |
| Leaderboard | Top recognized employees (weekly/monthly/quarterly), department leaderboards |
| Manager Nominations | Nominate employees for special awards (Employee of the Month, etc.) |
| Celebration Wall / Social Feed | Public feed of kudos, achievements, celebrations (birthdays, anniversaries) |
| Budget Management | Set recognition budgets per manager/department, track spend |
| Rewards Analytics | Recognition trends, most recognized values, department participation |
| Integration API | Summary endpoint for EMP Performance module |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js 20 |
| Backend | Express 5, TypeScript |
| Frontend | React 19, Vite 6, TypeScript |
| Styling | Tailwind CSS, Radix UI |
| Database | MySQL 8 via Knex.js (`emp_rewards` database) |
| Cache / Queue | Redis 7, BullMQ |
| Auth | OAuth2/OIDC via EMP Cloud (RS256 JWT verification) |

---

## Project Structure

```
emp-rewards/
  package.json
  pnpm-workspace.yaml
  tsconfig.json
  docker-compose.yml
  .env.example
  packages/
    shared/                     # @emp-rewards/shared
      src/
        types/                  # TypeScript interfaces & enums
        validators/             # Zod request validation schemas
        constants/              # Categories, defaults, permissions
    server/                     # @emp-rewards/server (port 4600)
      src/
        config/                 # Environment configuration
        db/
          connection.ts         # Knex connection to emp_rewards
          empcloud.ts           # Read-only connection to empcloud DB
          migrations/           # 5 migration files
        api/
          middleware/            # auth, RBAC, error handling
          routes/               # Route handlers per domain
        services/               # Business logic per domain
        jobs/                   # BullMQ workers (badge eval, leaderboard, celebrations)
        utils/                  # Logger, errors, response helpers
    client/                     # @emp-rewards/client (port 5180)
      src/
        api/                    # API client & hooks
        components/
          layout/               # DashboardLayout, SelfServiceLayout
          ui/                   # Radix-based UI primitives
        pages/                  # Route-based page components
        lib/                    # Auth store, utilities
```

---

## Database Tables

| Table | Purpose |
|-------|---------|
| `recognition_settings` | Per-org configuration (point values, kudos limits, moderation) |
| `recognition_categories` | Kudos categories (teamwork, innovation, leadership, etc.) |
| `kudos` | Core recognition records (sender, recipient, message, points) |
| `kudos_reactions` | Likes/emoji reactions on kudos |
| `kudos_comments` | Comments on public kudos |
| `point_balances` | Current redeemable balance per user |
| `point_transactions` | Ledger of all point changes (earn/spend) |
| `badge_definitions` | System and org-custom badge templates with criteria |
| `user_badges` | Badges earned by users |
| `reward_catalog` | Redeemable rewards with point cost and stock |
| `reward_redemptions` | Employee redemption requests with approval status |
| `nomination_programs` | Programs like "Employee of the Month" |
| `nominations` | Individual nominations submitted by managers |
| `leaderboard_cache` | Materialized leaderboard rankings (refreshed hourly) |
| `recognition_budgets` | Per-manager/department spend caps |
| `celebration_events` | Birthdays, work anniversaries, promotions |
| `notifications` | In-app notification queue |

---

## API Endpoints

All endpoints under `/api/v1/`. Server runs on port **4600**.

### Kudos / Recognition
| Method | Path | Description |
|--------|------|-------------|
| POST | `/kudos` | Send kudos |
| GET | `/kudos` | Public kudos feed |
| GET | `/kudos/:id` | Single kudos detail |
| DELETE | `/kudos/:id` | Retract own kudos |
| GET | `/kudos/received` | My received kudos |
| GET | `/kudos/sent` | My sent kudos |
| POST | `/kudos/:id/reactions` | React to kudos |
| POST | `/kudos/:id/comments` | Comment on kudos |

### Points
| Method | Path | Description |
|--------|------|-------------|
| GET | `/points/balance` | My point balance |
| GET | `/points/transactions` | My points history |
| POST | `/points/adjust` | Manual point adjustment (admin) |

### Badges
| Method | Path | Description |
|--------|------|-------------|
| GET | `/badges` | List badge definitions |
| POST | `/badges` | Create custom badge (admin) |
| GET | `/badges/my` | My earned badges |
| POST | `/badges/award` | Manually award badge (admin/manager) |

### Rewards Catalog
| Method | Path | Description |
|--------|------|-------------|
| GET | `/rewards` | Browse catalog |
| POST | `/rewards` | Create reward (admin) |
| POST | `/rewards/:id/redeem` | Redeem points for reward |

### Redemptions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/redemptions` | List all redemptions (admin) |
| GET | `/redemptions/my` | My redemptions |
| PUT | `/redemptions/:id/approve` | Approve redemption |
| PUT | `/redemptions/:id/fulfill` | Mark fulfilled |

### Nominations
| Method | Path | Description |
|--------|------|-------------|
| GET | `/nominations/programs` | List nomination programs |
| POST | `/nominations/programs` | Create program (admin) |
| POST | `/nominations` | Submit nomination |
| PUT | `/nominations/:id/review` | Review nomination (admin) |

### Leaderboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/leaderboard` | Org leaderboard (by period) |
| GET | `/leaderboard/department/:deptId` | Department leaderboard |
| GET | `/leaderboard/my-rank` | My current rank |

### Other Endpoints
- **Celebrations**: Upcoming celebrations, combined social feed
- **Settings**: Org recognition settings, category CRUD
- **Budgets**: CRUD budgets, usage tracking
- **Notifications**: List, mark read, unread count
- **Analytics**: Overview, trends, categories, departments, top recognizers, budget utilization
- **Integration**: `/integration/user/:userId/summary` for EMP Performance

---

## Frontend Pages

### Admin / Manager Views
| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Overview stats, recent activity, quick send kudos |
| `/feed` | Social Feed | Public celebration wall / social feed |
| `/kudos` | Kudos Management | All kudos with moderation tools |
| `/leaderboard` | Leaderboard | Org-wide leaderboard with period/dept filters |
| `/badges` | Badge Management | Create/manage badge definitions |
| `/rewards` | Reward Catalog Management | Manage reward catalog |
| `/redemptions` | Redemption Management | Approve/reject/fulfill redemptions |
| `/nominations` | Nomination Management | Manage programs, review nominations |
| `/budgets` | Budget Management | Set and track recognition budgets |
| `/analytics` | Analytics | Charts: trends, categories, departments, ROI |
| `/settings` | Settings | Org recognition settings, categories |

### Employee Self-Service
| Route | Page | Description |
|-------|------|-------------|
| `/my` | My Summary | Points balance, recent kudos, badges |
| `/my/kudos` | My Kudos | Send kudos, view sent/received |
| `/my/badges` | My Badges | Earned badges, progress toward next |
| `/my/rewards` | Reward Catalog | Browse and redeem rewards |
| `/my/redemptions` | My Redemptions | Track redemption status |
| `/my/notifications` | Notifications | Notification center |

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- MySQL 8+
- Redis 7+
- EMP Cloud running (for authentication)

### Install
```bash
git clone https://github.com/anthropic/emp-rewards.git
cd emp-rewards
pnpm install
```

### Environment Setup
```bash
cp .env.example .env
# Edit .env with your database credentials and EMP Cloud URL
```

### Docker
```bash
docker-compose up -d
```

### Development
```bash
# Run all packages in development mode
pnpm dev

# Run individually
pnpm --filter @emp-rewards/server dev    # Server on :4600
pnpm --filter @emp-rewards/client dev    # Client on :5180

# Run migrations
pnpm --filter @emp-rewards/server migrate
```

---

## Implementation Plan

### Phase 1: MVP (Weeks 1-3)
**Goal:** Basic peer recognition with points and a public feed.

- **Week 1:** Monorepo scaffolding, server/client/shared setup, dual DB connections, Migrations 001-002 (settings, categories, kudos, points, badges), seed default categories
- **Week 2:** Auth/RBAC middleware, settings service, kudos service (send, list, reactions), points service (balance, transactions, auto-credit), Zod validators
- **Week 3:** Client MVP -- Vite/React/Tailwind setup, auth flow, DashboardPage, SocialFeedPage, MyKudosPage, MySummaryPage

### Phase 2: Core Features (Weeks 4-6)
**Goal:** Badges, reward catalog, redemption workflow, leaderboard.

- **Week 4:** Badge service (CRUD, auto-evaluation via BullMQ), leaderboard service (compute + cache), BadgeManagementPage, LeaderboardPage
- **Week 5:** Migration 003 (rewards, redemptions), reward catalog CRUD, redemption workflow (atomic point debit), admin approval queue
- **Week 6:** Notification service, BullMQ notification dispatch, notification bell UI, kudos comments feature

### Phase 3: Advanced Features (Weeks 7-9)
**Goal:** Nominations, celebrations, budgets, analytics, integration.

- **Week 7:** Migration 004 (nominations, leaderboard cache), nomination programs/submissions, celebration auto-detection from empcloud, combined social feed
- **Week 8:** Migration 005 (budgets, celebrations), budget service, analytics service (trends, categories, departments), budget enforcement in redemption flow
- **Week 9:** Integration endpoint for EMP Performance, Docker Compose, unit tests (vitest), E2E tests (Playwright), seed data

---

## License

This project is licensed under the [AGPL-3.0 License](LICENSE).
