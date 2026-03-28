// ============================================================================
// EMP-REWARDS SERVER ENTRY POINT
// ============================================================================

import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { config } from "./config";
import { initDB, closeDB } from "./db/adapters";
import { initEmpCloudDB, migrateEmpCloudDB, closeEmpCloudDB } from "./db/empcloud";
import { logger } from "./utils/logger";

// Route imports
import { healthRoutes } from "./api/routes/health.routes";
import { kudosRoutes } from "./api/routes/kudos.routes";
import { pointsRoutes } from "./api/routes/points.routes";
import { badgeRoutes } from "./api/routes/badge.routes";
import { rewardRoutes } from "./api/routes/reward.routes";
import { redemptionRoutes } from "./api/routes/redemption.routes";
import { nominationRoutes } from "./api/routes/nomination.routes";
import { leaderboardRoutes } from "./api/routes/leaderboard.routes";
import { budgetRoutes } from "./api/routes/budget.routes";
import { analyticsRoutes } from "./api/routes/analytics.routes";
import { settingsRoutes } from "./api/routes/settings.routes";
import { slackRoutes } from "./api/routes/slack.routes";
import { teamsRoutes } from "./api/routes/teams.routes";
import { pushRoutes } from "./api/routes/push.routes";
import { celebrationRoutes } from "./api/routes/celebration.routes";
import { challengeRoutes } from "./api/routes/challenge.routes";
import { milestoneRoutes } from "./api/routes/milestone.routes";
import { authRoutes } from "./api/routes/auth.routes";
import { errorHandler } from "./api/middleware/error.middleware";
import { apiLimiter, authLimiter } from "./api/middleware/rate-limit.middleware";
import { scheduleDailyCelebrationJob, stopDailyCelebrationJob } from "./jobs/celebration.jobs";
import { swaggerUIHandler, openapiHandler } from "./api/docs";

const app = express();

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (config.cors.origin === "*") return callback(null, true);
      // Allow empcloud.com subdomains (production & test)
      if (origin.endsWith(".empcloud.com") && origin.startsWith("https://")) {
        return callback(null, true);
      }
      if (
        config.env === "development" &&
        (origin.startsWith("http://localhost") ||
          origin.startsWith("http://127.0.0.1") ||
          origin.endsWith(".ngrok-free.dev"))
      ) {
        return callback(null, true);
      }
      const allowed = config.cors.origin.split(",").map((s) => s.trim());
      if (allowed.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", { stream: { write: (msg) => logger.info(msg.trim()) } }));

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.use("/health", healthRoutes);

// ---------------------------------------------------------------------------
// API Routes (v1)
// ---------------------------------------------------------------------------
const v1 = express.Router();
v1.use(apiLimiter);

// Active routes
v1.use("/kudos", kudosRoutes);
v1.use("/points", pointsRoutes);
v1.use("/badges", badgeRoutes);
v1.use("/rewards", rewardRoutes);
v1.use("/redemptions", redemptionRoutes);
v1.use("/nominations", nominationRoutes);
v1.use("/leaderboard", leaderboardRoutes);
v1.use("/budgets", budgetRoutes);
v1.use("/analytics", analyticsRoutes);
v1.use("/manager", analyticsRoutes); // alias — clients calling /manager/dashboard get /analytics/manager/:id
v1.use("/settings", settingsRoutes);
v1.use("/slack", slackRoutes);
v1.use("/settings/teams", teamsRoutes);
v1.use("/push", pushRoutes);
v1.use("/celebrations", celebrationRoutes);
v1.use("/challenges", challengeRoutes);
v1.use("/milestones", milestoneRoutes);
v1.use("/auth", authLimiter, authRoutes);

app.use("/api/v1", v1);

// API Documentation
app.get("/api/docs", swaggerUIHandler);
app.get("/api/docs/openapi.json", openapiHandler);

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
  try {
    // Validate configuration
    const { validateConfig } = await import("./config/validate");
    validateConfig();

    // Initialize EmpCloud master database (users, orgs, auth)
    await initEmpCloudDB();
    await migrateEmpCloudDB();

    // Initialize rewards module database
    const db = await initDB();
    logger.info("Rewards database connected");

    // Run migrations
    await db.migrate();
    logger.info("Rewards database migrations applied");

    // Schedule daily celebration job
    scheduleDailyCelebrationJob();

    // Start server
    app.listen(config.port, config.host, () => {
      logger.info(`emp-rewards server running at http://${config.host}:${config.port}`);
      logger.info(`   Environment: ${config.env}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
const shutdown = async () => {
  logger.info("Shutting down...");
  stopDailyCelebrationJob();
  await closeDB();
  await closeEmpCloudDB();
  process.exit(0);
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

start();

export { app };
