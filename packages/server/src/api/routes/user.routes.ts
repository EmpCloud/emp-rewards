// ============================================================================
// USER ROUTES
// Lightweight cross-DB lookup of empcloud.users so the rewards UI can offer
// employee pickers (Send Kudos, Nominations, Challenge join, etc.) without
// the user having to remember another employee's numeric ID. Issue #15.
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { getEmpCloudDB } from "../../db/empcloud";
import { sendSuccess } from "../../utils/response";

const router = Router();
router.use(authenticate);

// ---------------------------------------------------------------------------
// GET /users/search?q=...&limit=20
// Returns active users in the caller's org whose first/last/email matches
// the query (case-insensitive prefix). Empty/short query returns the org's
// first 20 users so the dropdown isn't useless on initial focus.
// ---------------------------------------------------------------------------
router.get("/search", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const callerId = req.user!.empcloudUserId;
    const q = (req.query.q as string | undefined)?.trim() ?? "";
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

    const db = getEmpCloudDB();
    let query = db("users")
      .where({ organization_id: orgId, status: 1 })
      .whereNot({ id: callerId })
      .select("id", "first_name", "last_name", "email", "designation");

    if (q.length > 0) {
      const like = `%${q}%`;
      query = query.where((qb) => {
        qb.where("first_name", "like", like)
          .orWhere("last_name", "like", like)
          .orWhere("email", "like", like)
          .orWhereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [like]);
      });
    }

    const rows = await query.orderBy("first_name", "asc").limit(limit);
    return sendSuccess(res, rows);
  } catch (err) {
    next(err);
  }
});

export { router as userRoutes };
