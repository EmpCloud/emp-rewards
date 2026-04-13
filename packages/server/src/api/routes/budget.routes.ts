// ============================================================================
// BUDGET ROUTES
// GET /, POST / (admin), GET /:id, PUT /:id (admin), GET /:id/usage
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as budgetService from "../../services/budget/budget.service";
import { sendSuccess } from "../../utils/response";
import { ValidationError } from "../../utils/errors";

const router = Router();

// All budget routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const createBudgetSchema = z.object({
  budget_type: z.enum(["manager", "department"]),
  owner_id: z.number().int().positive(),
  department_id: z.number().int().positive().optional().nullable(),
  period: z.enum(["monthly", "quarterly", "annual"]),
  total_amount: z.number().positive("Budget amount must be positive"),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD format"),
});

const updateBudgetSchema = z.object({
  total_amount: z.number().positive().optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// GET / — list budgets
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const page = parseInt(req.query.page as string) || 1;
    const perPage = parseInt(req.query.perPage as string) || 20;
    const budgetType = req.query.budgetType as string | undefined;

    const result = await budgetService.listBudgets(orgId, { page, perPage, budgetType });
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST / — create budget (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/",
  authorize("org_admin", "hr_admin", "hr_manager"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".");
          details[key] = details[key] || [];
          details[key].push(issue.message);
        }
        throw new ValidationError("Invalid input", details);
      }

      const orgId = req.user!.empcloudOrgId;
      const budget = await budgetService.createBudget(orgId, parsed.data);
      sendSuccess(res, budget, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id — get single budget
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const budget = await budgetService.getBudget(orgId, req.params.id as string);
    sendSuccess(res, budget);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — update budget (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/:id",
  authorize("org_admin", "hr_admin", "hr_manager"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateBudgetSchema.safeParse(req.body);
      if (!parsed.success) {
        const details: Record<string, string[]> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path.join(".");
          details[key] = details[key] || [];
          details[key].push(issue.message);
        }
        throw new ValidationError("Invalid input", details);
      }

      const orgId = req.user!.empcloudOrgId;
      const budget = await budgetService.updateBudget(orgId, req.params.id as string, parsed.data);
      sendSuccess(res, budget);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /:id/usage — budget usage breakdown
// ---------------------------------------------------------------------------
router.get("/:id/usage", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const usage = await budgetService.getBudgetUsage(orgId, req.params.id as string);
    sendSuccess(res, usage);
  } catch (err) {
    next(err);
  }
});

export { router as budgetRoutes };
