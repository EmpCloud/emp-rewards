// ============================================================================
// LEADERBOARD ROUTES
// GET / (query: period, periodKey), GET /department/:deptId, GET /my-rank
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import * as leaderboardService from "../../services/leaderboard/leaderboard.service";
import { sendSuccess } from "../../utils/response";

const router = Router();

// All leaderboard routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET / — leaderboard for a period
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const periodType = (req.query.period as string) || "monthly";
    const periodKey = (req.query.periodKey as string) || getCurrentPeriodKey(periodType);
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;

    const result = await leaderboardService.getLeaderboard(orgId, periodType, periodKey, { page, perPage });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /department/:deptId — department-specific leaderboard
// ---------------------------------------------------------------------------
router.get("/department/:deptId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const departmentId = parseInt(req.params.deptId as string);
    const periodType = (req.query.period as string) || "monthly";
    const periodKey = (req.query.periodKey as string) || getCurrentPeriodKey(periodType);

    const entries = await leaderboardService.getDepartmentLeaderboard(orgId, departmentId, periodType, periodKey);
    sendSuccess(res, { entries });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /my-rank — current user's rank
// ---------------------------------------------------------------------------
router.get("/my-rank", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    const periodType = (req.query.period as string) || "monthly";
    const periodKey = (req.query.periodKey as string) || getCurrentPeriodKey(periodType);

    const rank = await leaderboardService.getMyRank(orgId, userId, periodType, periodKey);
    sendSuccess(res, rank);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Helper: generate current period key
// ---------------------------------------------------------------------------
function getCurrentPeriodKey(periodType: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  switch (periodType) {
    case "weekly": {
      const startOfYear = new Date(year, 0, 1);
      const days = Math.floor((now.getTime() - startOfYear.getTime()) / 86400000);
      const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
      return `${year}-W${String(week).padStart(2, "0")}`;
    }
    case "quarterly": {
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      return `${year}-Q${quarter}`;
    }
    case "yearly":
      return `${year}`;
    case "all_time":
      return "all";
    default: // monthly
      return `${year}-${month}`;
  }
}

export { router as leaderboardRoutes };
