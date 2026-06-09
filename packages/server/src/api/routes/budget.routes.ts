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
// Accept a plain YYYY-MM-DD date OR a full ISO timestamp (the API echoes dates
// back as ISO, so an edit round-trip would otherwise fail validation) and
// normalize to the YYYY-MM-DD date part.
const dateLike = z
  .string()
  .refine((v) => /^\d{4}-\d{2}-\d{2}/.test(v), "Use YYYY-MM-DD format")
  .transform((v) => v.slice(0, 10));

const createBudgetSchema = z.object({
  budget_type: z.enum(["manager", "department"]),
  owner_id: z.number().int().positive(),
  department_id: z.number().int().positive().optional().nullable(),
  period: z.enum(["monthly", "quarterly", "annual"]),
  total_amount: z.coerce.number().positive("Budget amount must be positive"),
  period_start: dateLike,
  period_end: dateLike,
});

const updateBudgetSchema = z.object({
  total_amount: z.coerce.number().positive().optional(),
  period_start: dateLike.optional(),
  period_end: dateLike.optional(),
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
// DELETE /:id — delete budget (admin only)
// ---------------------------------------------------------------------------
router.delete(
  "/:id",
  authorize("org_admin", "hr_admin", "hr_manager"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      await budgetService.deleteBudget(orgId, req.params.id as string);
      sendSuccess(res, { message: "Budget deleted" });
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
