// ============================================================================
// SETTINGS ROUTES
// GET /, PUT / (admin), GET /categories, POST /categories (admin),
// PUT /categories/:id (admin), DELETE /categories/:id (admin)
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as settingsService from "../../services/settings/settings.service";
import { sendSuccess } from "../../utils/response";
import { ValidationError } from "../../utils/errors";

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
const updateSettingsSchema = z.object({
  points_per_kudos: z.number().int().min(0).optional(),
  max_kudos_per_day: z.number().int().min(1).optional(),
  allow_self_kudos: z.boolean().optional(),
  allow_anonymous_kudos: z.boolean().optional(),
  default_visibility: z.enum(["public", "private"]).optional(),
  points_currency_name: z.string().min(1).max(50).optional(),
  require_category: z.boolean().optional(),
  require_message: z.boolean().optional(),
});

const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  points_multiplier: z.number().min(0.1).max(10).optional(),
  sort_order: z.number().int().optional(),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  points_multiplier: z.number().min(0.1).max(10).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

// ---------------------------------------------------------------------------
// GET / — get settings
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const settings = await settingsService.getSettings(orgId);
    sendSuccess(res, settings);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PUT / — update settings (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateSettingsSchema.safeParse(req.body);
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
      const settings = await settingsService.updateSettings(orgId, parsed.data);
      sendSuccess(res, settings);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// GET /categories — list categories
// ---------------------------------------------------------------------------
router.get("/categories", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const includeInactive = req.query.includeInactive === "true";
    const categories = await settingsService.getCategories(orgId, { includeInactive });
    sendSuccess(res, categories);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /categories — create category (admin only)
// ---------------------------------------------------------------------------
router.post(
  "/categories",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = createCategorySchema.safeParse(req.body);
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
      const category = await settingsService.createCategory(orgId, parsed.data);
      sendSuccess(res, category, 201);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// PUT /categories/:id — update category (admin only)
// ---------------------------------------------------------------------------
router.put(
  "/categories/:id",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = updateCategorySchema.safeParse(req.body);
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
      const category = await settingsService.updateCategory(orgId, req.params.id, parsed.data);
      sendSuccess(res, category);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// DELETE /categories/:id — delete (deactivate) category (admin only)
// ---------------------------------------------------------------------------
router.delete(
  "/categories/:id",
  authorize("org_admin", "hr_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      await settingsService.deleteCategory(orgId, req.params.id);
      sendSuccess(res, { message: "Category deactivated" });
    } catch (err) {
      next(err);
    }
  },
);

export { router as settingsRoutes };
