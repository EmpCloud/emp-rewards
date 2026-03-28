// ============================================================================
// ANALYTICS ROUTES
// GET /overview, /trends, /categories, /departments, /top-recognizers,
//     /top-recognized, /budget-utilization
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as analyticsService from "../../services/analytics/analytics.service";
import { sendSuccess } from "../../utils/response";

const router = Router();

// All analytics routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /dashboard — alias for overview (used by /manager/dashboard clients)
// ---------------------------------------------------------------------------
router.get("/dashboard", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const overview = await analyticsService.getOverview(orgId);
    sendSuccess(res, overview);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /overview
// ---------------------------------------------------------------------------
router.get("/overview", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const overview = await analyticsService.getOverview(orgId);
    sendSuccess(res, overview);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /trends
// ---------------------------------------------------------------------------
router.get("/trends", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const interval = (req.query.interval as string) || "week";
    const months = parseInt(req.query.months as string) || 6;
    const trends = await analyticsService.getTrends(orgId, { interval, months });
    sendSuccess(res, trends);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /categories
// ---------------------------------------------------------------------------
router.get("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const breakdown = await analyticsService.getCategoryBreakdown(orgId);
    sendSuccess(res, breakdown);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /departments
// ---------------------------------------------------------------------------
router.get("/departments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const participation = await analyticsService.getDepartmentParticipation(orgId);
    sendSuccess(res, participation);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /top-recognizers
// ---------------------------------------------------------------------------
router.get("/top-recognizers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const limit = parseInt(req.query.limit as string) || 10;
    const recognizers = await analyticsService.getTopRecognizers(orgId, limit);
    sendSuccess(res, recognizers);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /top-recognized
// ---------------------------------------------------------------------------
router.get("/top-recognized", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const limit = parseInt(req.query.limit as string) || 10;
    const recognized = await analyticsService.getTopRecognized(orgId, limit);
    sendSuccess(res, recognized);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /budget-utilization
// ---------------------------------------------------------------------------
router.get("/budget-utilization", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const utilization = await analyticsService.getBudgetUtilization(orgId);
    sendSuccess(res, utilization);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /manager/:managerId — Manager's team dashboard
// ---------------------------------------------------------------------------
router.get("/manager/:managerId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const managerId = parseInt(req.params.managerId);
    const dashboard = await analyticsService.getManagerDashboard(orgId, managerId);
    sendSuccess(res, dashboard);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /managers — Comparison across all managers
// ---------------------------------------------------------------------------
router.get("/managers", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const comparison = await analyticsService.getManagerComparison(orgId);
    sendSuccess(res, comparison);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /team-comparison — alias for /managers (used by /manager/team-comparison) (#879)
// ---------------------------------------------------------------------------
router.get("/team-comparison", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const comparison = await analyticsService.getManagerComparison(orgId);
    sendSuccess(res, comparison);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /recommendations — recognition recommendations for current user (#880)
// ---------------------------------------------------------------------------
router.get("/recommendations", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const managerId = req.user!.empcloudUserId;
    const dashboard = await analyticsService.getManagerDashboard(orgId, managerId);

    // Generate recommendations based on team data
    const recommendations: any[] = [];
    const teamMembers = dashboard.teamMembers || [];

    // Find team members with low recognition
    const lowRecognition = teamMembers.filter((m: any) => Number(m.kudos_received) === 0);
    for (const member of lowRecognition.slice(0, 3)) {
      recommendations.push({
        type: "recognize",
        priority: "high",
        message: `${member.first_name} ${member.last_name} hasn't received any kudos this month. Consider recognizing their contributions.`,
        user_id: member.user_id,
      });
    }

    // If manager hasn't given enough kudos
    if (dashboard.kudosGivenThisMonth < dashboard.teamSize) {
      recommendations.push({
        type: "engage",
        priority: "medium",
        message: `You've sent ${dashboard.kudosGivenThisMonth} kudos this month for a team of ${dashboard.teamSize}. Try to recognize each team member at least once per month.`,
      });
    }

    // If team engagement is below org average
    if (dashboard.engagementScore < dashboard.orgAverageEngagement) {
      recommendations.push({
        type: "improve",
        priority: "medium",
        message: `Your team's engagement score (${dashboard.engagementScore}) is below the org average (${dashboard.orgAverageEngagement}). Consider running a team challenge.`,
      });
    }

    sendSuccess(res, { recommendations, teamSize: dashboard.teamSize, engagementScore: dashboard.engagementScore });
  } catch (err) {
    next(err);
  }
});

export { router as analyticsRoutes };
