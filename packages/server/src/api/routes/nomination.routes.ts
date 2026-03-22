// ============================================================================
// NOMINATION ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate, authorize } from "../middleware/auth.middleware";
import * as nominationService from "../../services/nomination/nomination.service";
import {
  createNominationProgramSchema,
  submitNominationSchema,
  reviewNominationSchema,
  paginationSchema,
  idParamSchema,
} from "@emp-rewards/shared";
import { ValidationError } from "../../utils/errors";
import type { ApiResponse } from "@emp-rewards/shared";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// PROGRAMS
// ---------------------------------------------------------------------------

// GET /programs — List nomination programs
router.get("/programs", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const pagination = paginationSchema.parse(req.query);
    const is_active = req.query.is_active === "false" ? false : undefined;

    const result = await nominationService.listPrograms(orgId, {
      page: pagination.page,
      perPage: pagination.perPage,
      is_active,
    });

    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// POST /programs — Create nomination program (admin)
router.post(
  "/programs",
  authorize("org_admin", "hr_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const createdBy = req.user!.empcloudUserId;
      const parsed = createNominationProgramSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid program data", {
          validation: parsed.error.errors.map((e) => e.message),
        });
      }

      const program = await nominationService.createProgram(orgId, createdBy, parsed.data);
      const response: ApiResponse<typeof program> = { success: true, data: program };
      res.status(201).json(response);
    } catch (err) {
      next(err);
    }
  },
);

// PUT /programs/:id — Update nomination program (admin)
router.put(
  "/programs/:id",
  authorize("org_admin", "hr_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const { id } = idParamSchema.parse(req.params);
      const parsed = createNominationProgramSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid program data", {
          validation: parsed.error.errors.map((e) => e.message),
        });
      }

      const program = await nominationService.updateProgram(orgId, id, parsed.data);
      const response: ApiResponse<typeof program> = { success: true, data: program };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

// ---------------------------------------------------------------------------
// NOMINATIONS
// ---------------------------------------------------------------------------

// POST / — Submit a nomination
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const nominatorId = req.user!.empcloudUserId;
    const parsed = submitNominationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError("Invalid nomination data", {
        validation: parsed.error.errors.map((e) => e.message),
      });
    }

    const nomination = await nominationService.submitNomination(
      orgId,
      nominatorId,
      parsed.data,
    );
    const response: ApiResponse<typeof nomination> = { success: true, data: nomination };
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

// GET / — List nominations (admin view with filters)
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const pagination = paginationSchema.parse(req.query);
    const programId = req.query.programId as string | undefined;
    const status = req.query.status as string | undefined;

    const result = await nominationService.listNominations(orgId, {
      page: pagination.page,
      perPage: pagination.perPage,
      programId,
      status,
      sort: pagination.sort,
      order: pagination.order,
    });

    const response: ApiResponse<typeof result> = { success: true, data: result };
    res.json(response);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/review — Review a nomination (admin)
router.put(
  "/:id/review",
  authorize("org_admin", "hr_admin", "super_admin"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = req.user!.empcloudOrgId;
      const reviewedBy = req.user!.empcloudUserId;
      const { id } = idParamSchema.parse(req.params);
      const parsed = reviewNominationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ValidationError("Invalid review data", {
          validation: parsed.error.errors.map((e) => e.message),
        });
      }

      const nomination = await nominationService.reviewNomination(
        orgId,
        id,
        parsed.data.status,
        reviewedBy,
        parsed.data.review_note ?? undefined,
      );
      const response: ApiResponse<typeof nomination> = { success: true, data: nomination };
      res.json(response);
    } catch (err) {
      next(err);
    }
  },
);

export { router as nominationRoutes };
