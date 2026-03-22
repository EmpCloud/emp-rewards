// ============================================================================
// KUDOS ROUTES
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/auth.middleware";
import { sendSuccess, sendPaginated } from "../../utils/response";
import { sendKudosSchema, addReactionSchema, addCommentSchema, paginationSchema } from "@emp-rewards/shared";
import * as kudosService from "../../services/kudos/kudos.service";

const router = Router();

// All routes require authentication
router.use(authenticate);

// ---------------------------------------------------------------------------
// POST / — Send kudos
// ---------------------------------------------------------------------------
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const senderId = req.user!.empcloudUserId;
    const data = sendKudosSchema.parse(req.body);
    const kudos = await kudosService.sendKudos(orgId, senderId, data);
    return sendSuccess(res, kudos, 201);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET / — Public feed (paginated)
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const params = paginationSchema.parse(req.query);
    const result = await kudosService.getPublicFeed(orgId, {
      page: params.page,
      perPage: params.perPage,
    });
    return sendPaginated(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Single kudos with reactions + comments
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const result = await kudosService.getKudos(orgId, req.params.id);
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Delete kudos (sender only)
// ---------------------------------------------------------------------------
router.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const orgId = req.user!.empcloudOrgId;
    const userId = req.user!.empcloudUserId;
    await kudosService.deleteKudos(orgId, req.params.id, userId);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/reactions — Add reaction
// ---------------------------------------------------------------------------
router.post("/:id/reactions", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.empcloudUserId;
    const parsed = addReactionSchema.parse({
      kudos_id: req.params.id,
      reaction_type: req.body.reaction_type,
    });
    await kudosService.addReaction(parsed.kudos_id, userId, parsed.reaction_type);
    return sendSuccess(res, { added: true }, 201);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/reactions/:reaction — Remove reaction
// ---------------------------------------------------------------------------
router.delete("/:id/reactions/:reaction", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.empcloudUserId;
    await kudosService.removeReaction(req.params.id, userId, req.params.reaction);
    return sendSuccess(res, { removed: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /:id/comments — Add comment
// ---------------------------------------------------------------------------
router.post("/:id/comments", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.empcloudUserId;
    const parsed = addCommentSchema.parse({
      kudos_id: req.params.id,
      content: req.body.content,
    });
    const comment = await kudosService.addComment(parsed.kudos_id, userId, parsed.content);
    return sendSuccess(res, comment, 201);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/comments/:commentId — Delete comment
// ---------------------------------------------------------------------------
router.delete("/:id/comments/:commentId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.empcloudUserId;
    await kudosService.deleteComment(req.params.commentId, userId);
    return sendSuccess(res, { deleted: true });
  } catch (err) {
    next(err);
  }
});

export { router as kudosRoutes };
