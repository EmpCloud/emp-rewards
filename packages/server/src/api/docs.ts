// ============================================================================
// EMP-REWARDS — OpenAPI / Swagger Documentation
// ============================================================================

import { Request, Response } from "express";

const spec = {
  openapi: "3.0.3",
  info: {
    title: "EMP Rewards API",
    version: "1.0.0",
    description:
      "Employee recognition and rewards module for the EMP HRMS ecosystem. Manages kudos, points, badges, rewards catalog, redemptions, nominations, leaderboards, budgets, celebrations, and Slack integration.",
  },
  servers: [{ url: "http://localhost:3003", description: "Local development" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http" as const, scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      ApiResponse: {
        type: "object" as const,
        properties: {
          success: { type: "boolean" },
          data: { type: "object" },
        },
      },
      Error: {
        type: "object" as const,
        properties: {
          success: { type: "boolean", example: false },
          error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } },
        },
      },
    },
  },
  paths: {
    // =========================================================================
    // AUTH
    // =========================================================================
    "/api/v1/auth/login": {
      post: { tags: ["Auth"], summary: "Login with email and password", security: [], responses: { "200": { description: "Login successful" } } },
    },
    "/api/v1/auth/register": {
      post: { tags: ["Auth"], summary: "Register a new organization", security: [], responses: { "201": { description: "Registered" } } },
    },
    "/api/v1/auth/sso": {
      post: { tags: ["Auth"], summary: "SSO authentication via EMP Cloud token", security: [], responses: { "200": { description: "SSO login successful" } } },
    },
    "/api/v1/auth/refresh-token": {
      post: { tags: ["Auth"], summary: "Refresh access token", security: [], responses: { "200": { description: "New tokens" } } },
    },

    // =========================================================================
    // KUDOS
    // =========================================================================
    "/api/v1/kudos": {
      get: {
        tags: ["Kudos"],
        summary: "List kudos feed (paginated)",
        parameters: [
          { name: "page", in: "query", schema: { type: "integer" } },
          { name: "per_page", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Kudos feed" } },
      },
      post: { tags: ["Kudos"], summary: "Send kudos to a colleague", responses: { "201": { description: "Kudos sent" } } },
    },
    "/api/v1/kudos/{id}": {
      get: {
        tags: ["Kudos"],
        summary: "Get kudos by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Kudos data" } },
      },
      delete: {
        tags: ["Kudos"],
        summary: "Delete kudos",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Kudos deleted" } },
      },
    },
    "/api/v1/kudos/{id}/reactions": {
      post: {
        tags: ["Kudos"],
        summary: "Add reaction to kudos",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "201": { description: "Reaction added" } },
      },
    },
    "/api/v1/kudos/{id}/reactions/{reaction}": {
      delete: {
        tags: ["Kudos"],
        summary: "Remove reaction from kudos",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "reaction", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Reaction removed" } },
      },
    },
    "/api/v1/kudos/{id}/comments": {
      post: {
        tags: ["Kudos"],
        summary: "Add comment to kudos",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "201": { description: "Comment added" } },
      },
    },
    "/api/v1/kudos/{id}/comments/{commentId}": {
      delete: {
        tags: ["Kudos"],
        summary: "Delete comment from kudos",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "integer" } },
          { name: "commentId", in: "path", required: true, schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Comment deleted" } },
      },
    },

    // =========================================================================
    // POINTS
    // =========================================================================
    "/api/v1/points/balance": {
      get: { tags: ["Points"], summary: "Get current user point balance", responses: { "200": { description: "Point balance" } } },
    },
    "/api/v1/points/transactions": {
      get: { tags: ["Points"], summary: "List point transactions (paginated)", responses: { "200": { description: "Transaction list" } } },
    },
    "/api/v1/points/award": {
      post: { tags: ["Points"], summary: "Award points to an employee (admin)", responses: { "201": { description: "Points awarded" } } },
    },

    // =========================================================================
    // BADGES
    // =========================================================================
    "/api/v1/badges": {
      get: { tags: ["Badges"], summary: "List available badges", responses: { "200": { description: "Badge list" } } },
      post: { tags: ["Badges"], summary: "Create a badge (admin)", responses: { "201": { description: "Badge created" } } },
    },
    "/api/v1/badges/my": {
      get: { tags: ["Badges"], summary: "List my earned badges", responses: { "200": { description: "My badges" } } },
    },
    "/api/v1/badges/user/{userId}": {
      get: {
        tags: ["Badges"],
        summary: "List badges for a specific user",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "User badges" } },
      },
    },
    "/api/v1/badges/{id}": {
      get: {
        tags: ["Badges"],
        summary: "Get badge by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Badge data" } },
      },
      put: {
        tags: ["Badges"],
        summary: "Update badge",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Badge updated" } },
      },
      delete: {
        tags: ["Badges"],
        summary: "Delete badge",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Badge deleted" } },
      },
    },
    "/api/v1/badges/{id}/award": {
      post: {
        tags: ["Badges"],
        summary: "Award badge to an employee",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "201": { description: "Badge awarded" } },
      },
    },

    // =========================================================================
    // REWARDS
    // =========================================================================
    "/api/v1/rewards": {
      get: { tags: ["Rewards"], summary: "List rewards catalog (paginated)", responses: { "200": { description: "Reward list" } } },
      post: { tags: ["Rewards"], summary: "Create a reward (admin)", responses: { "201": { description: "Reward created" } } },
    },
    "/api/v1/rewards/{id}": {
      get: {
        tags: ["Rewards"],
        summary: "Get reward by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Reward data" } },
      },
      put: {
        tags: ["Rewards"],
        summary: "Update reward",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Reward updated" } },
      },
      delete: {
        tags: ["Rewards"],
        summary: "Delete reward",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Reward deleted" } },
      },
    },
    "/api/v1/rewards/{id}/redeem": {
      post: {
        tags: ["Rewards"],
        summary: "Redeem a reward using points",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "201": { description: "Redemption created" } },
      },
    },

    // =========================================================================
    // REDEMPTIONS
    // =========================================================================
    "/api/v1/redemptions/my": {
      get: { tags: ["Redemptions"], summary: "List my redemptions", responses: { "200": { description: "My redemptions" } } },
    },
    "/api/v1/redemptions": {
      get: { tags: ["Redemptions"], summary: "List all redemptions (admin, paginated)", responses: { "200": { description: "Redemption list" } } },
    },
    "/api/v1/redemptions/{id}": {
      get: {
        tags: ["Redemptions"],
        summary: "Get redemption by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Redemption data" } },
      },
    },
    "/api/v1/redemptions/{id}/approve": {
      put: {
        tags: ["Redemptions"],
        summary: "Approve redemption",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Redemption approved" } },
      },
    },
    "/api/v1/redemptions/{id}/reject": {
      put: {
        tags: ["Redemptions"],
        summary: "Reject redemption",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Redemption rejected" } },
      },
    },
    "/api/v1/redemptions/{id}/fulfill": {
      put: {
        tags: ["Redemptions"],
        summary: "Mark redemption as fulfilled",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Redemption fulfilled" } },
      },
    },

    // =========================================================================
    // NOMINATIONS
    // =========================================================================
    "/api/v1/nominations/programs": {
      get: { tags: ["Nominations"], summary: "List nomination programs", responses: { "200": { description: "Program list" } } },
      post: { tags: ["Nominations"], summary: "Create nomination program (admin)", responses: { "201": { description: "Program created" } } },
    },
    "/api/v1/nominations/programs/{id}": {
      put: {
        tags: ["Nominations"],
        summary: "Update nomination program",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Program updated" } },
      },
    },
    "/api/v1/nominations": {
      get: { tags: ["Nominations"], summary: "List nominations (paginated)", responses: { "200": { description: "Nomination list" } } },
      post: { tags: ["Nominations"], summary: "Submit a nomination", responses: { "201": { description: "Nomination submitted" } } },
    },
    "/api/v1/nominations/{id}/review": {
      put: {
        tags: ["Nominations"],
        summary: "Review/decide on a nomination",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Nomination reviewed" } },
      },
    },

    // =========================================================================
    // LEADERBOARD
    // =========================================================================
    "/api/v1/leaderboard": {
      get: {
        tags: ["Leaderboard"],
        summary: "Get recognition leaderboard",
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["week", "month", "quarter", "year"] } },
          { name: "limit", in: "query", schema: { type: "integer" } },
        ],
        responses: { "200": { description: "Leaderboard data" } },
      },
    },
    "/api/v1/leaderboard/department/{deptId}": {
      get: {
        tags: ["Leaderboard"],
        summary: "Get department leaderboard",
        parameters: [{ name: "deptId", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Department leaderboard" } },
      },
    },
    "/api/v1/leaderboard/my-rank": {
      get: { tags: ["Leaderboard"], summary: "Get my rank on leaderboard", responses: { "200": { description: "My rank data" } } },
    },

    // =========================================================================
    // BUDGETS
    // =========================================================================
    "/api/v1/budgets": {
      get: { tags: ["Budgets"], summary: "List recognition budgets", responses: { "200": { description: "Budget list" } } },
      post: { tags: ["Budgets"], summary: "Create a recognition budget (admin)", responses: { "201": { description: "Budget created" } } },
    },
    "/api/v1/budgets/{id}": {
      get: {
        tags: ["Budgets"],
        summary: "Get budget by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Budget data" } },
      },
      put: {
        tags: ["Budgets"],
        summary: "Update budget",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Budget updated" } },
      },
    },
    "/api/v1/budgets/{id}/usage": {
      get: {
        tags: ["Budgets"],
        summary: "Get budget usage report",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Usage data" } },
      },
    },

    // =========================================================================
    // ANALYTICS
    // =========================================================================
    "/api/v1/analytics/overview": {
      get: { tags: ["Analytics"], summary: "Rewards overview metrics", responses: { "200": { description: "Overview data" } } },
    },
    "/api/v1/analytics/trends": {
      get: { tags: ["Analytics"], summary: "Recognition trends over time", responses: { "200": { description: "Trend data" } } },
    },
    "/api/v1/analytics/categories": {
      get: { tags: ["Analytics"], summary: "Recognition by category breakdown", responses: { "200": { description: "Category data" } } },
    },
    "/api/v1/analytics/departments": {
      get: { tags: ["Analytics"], summary: "Recognition by department", responses: { "200": { description: "Department data" } } },
    },
    "/api/v1/analytics/top-recognizers": {
      get: { tags: ["Analytics"], summary: "Top recognizers", responses: { "200": { description: "Top recognizers" } } },
    },
    "/api/v1/analytics/top-recognized": {
      get: { tags: ["Analytics"], summary: "Most recognized employees", responses: { "200": { description: "Top recognized" } } },
    },
    "/api/v1/analytics/budget-utilization": {
      get: { tags: ["Analytics"], summary: "Budget utilization report", responses: { "200": { description: "Utilization data" } } },
    },

    // =========================================================================
    // SETTINGS
    // =========================================================================
    "/api/v1/settings": {
      get: { tags: ["Settings"], summary: "Get rewards module settings", responses: { "200": { description: "Settings data" } } },
      put: { tags: ["Settings"], summary: "Update rewards module settings (admin)", responses: { "200": { description: "Settings updated" } } },
    },
    "/api/v1/settings/categories": {
      get: { tags: ["Settings"], summary: "List recognition categories", responses: { "200": { description: "Category list" } } },
      post: { tags: ["Settings"], summary: "Create recognition category", responses: { "201": { description: "Category created" } } },
    },
    "/api/v1/settings/categories/{id}": {
      put: {
        tags: ["Settings"],
        summary: "Update recognition category",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Category updated" } },
      },
      delete: {
        tags: ["Settings"],
        summary: "Delete recognition category",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Category deleted" } },
      },
    },

    // =========================================================================
    // CELEBRATIONS
    // =========================================================================
    "/api/v1/celebrations/today": {
      get: { tags: ["Celebrations"], summary: "Get today's celebrations", responses: { "200": { description: "Today's celebrations" } } },
    },
    "/api/v1/celebrations/upcoming": {
      get: { tags: ["Celebrations"], summary: "Get upcoming celebrations", responses: { "200": { description: "Upcoming celebrations" } } },
    },
    "/api/v1/celebrations/feed": {
      get: { tags: ["Celebrations"], summary: "Celebration feed (paginated)", responses: { "200": { description: "Celebration feed" } } },
    },
    "/api/v1/celebrations/{id}": {
      get: {
        tags: ["Celebrations"],
        summary: "Get celebration by ID",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "200": { description: "Celebration data" } },
      },
    },
    "/api/v1/celebrations/{id}/wish": {
      post: {
        tags: ["Celebrations"],
        summary: "Send a celebration wish",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
        responses: { "201": { description: "Wish sent" } },
      },
    },

    // =========================================================================
    // SLACK
    // =========================================================================
    "/api/v1/slack/webhook": {
      post: { tags: ["Slack"], summary: "Slack webhook handler", security: [], responses: { "200": { description: "Webhook processed" } } },
    },
    "/api/v1/slack/config": {
      get: { tags: ["Slack"], summary: "Get Slack integration config", responses: { "200": { description: "Slack config" } } },
      put: { tags: ["Slack"], summary: "Update Slack integration config", responses: { "200": { description: "Config updated" } } },
    },
    "/api/v1/slack/test": {
      post: { tags: ["Slack"], summary: "Test Slack integration", responses: { "200": { description: "Test result" } } },
    },

    // =========================================================================
    // HEALTH
    // =========================================================================
    "/health": {
      get: { tags: ["Health"], summary: "Health check", security: [], responses: { "200": { description: "Server is healthy" } } },
    },
  },
};

export function swaggerUIHandler(_req: Request, res: Response) {
  res.send(`<!DOCTYPE html>
<html><head><title>EMP Rewards API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head><body>
<div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: '/api/docs/openapi.json', dom_id: '#swagger-ui' })</script>
</body></html>`);
}

export function openapiHandler(_req: Request, res: Response) {
  res.json(spec);
}
