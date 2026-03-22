// ============================================================================
// NOMINATION SERVICE
// ============================================================================

import { getDB } from "../../db/adapters";
import { logger } from "../../utils/logger";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type {
  NominationProgram,
  Nomination,
  NominationStatus,
  PointBalance,
  PaginatedResponse,
} from "@emp-rewards/shared";

const PROGRAMS_TABLE = "nomination_programs";
const NOMINATIONS_TABLE = "nominations";
const BALANCES_TABLE = "point_balances";
const TRANSACTIONS_TABLE = "point_transactions";
const BADGES_TABLE = "user_badges";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateProgramData {
  name: string;
  description?: string | null;
  frequency: string;
  nominations_per_user?: number;
  points_awarded?: number;
  start_date: string;
  end_date?: string | null;
  is_active?: boolean;
}

interface SubmitNominationData {
  program_id: string;
  nominee_id: number;
  reason: string;
}

interface ListNominationsParams {
  page?: number;
  perPage?: number;
  programId?: string;
  status?: string;
  sort?: string;
  order?: "asc" | "desc";
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

export async function createProgram(
  orgId: number,
  createdBy: number,
  data: CreateProgramData,
): Promise<NominationProgram> {
  const db = getDB();
  const program = await db.create<NominationProgram>(PROGRAMS_TABLE, {
    organization_id: orgId,
    created_by: createdBy,
    ...data,
  });
  logger.info(`Nomination program created: ${program.id} for org ${orgId}`);
  return program;
}

export async function listPrograms(
  orgId: number,
  params: { page?: number; perPage?: number; is_active?: boolean } = {},
): Promise<PaginatedResponse<NominationProgram>> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };
  if (params.is_active !== undefined) filters.is_active = params.is_active;

  const result = await db.findMany<NominationProgram>(PROGRAMS_TABLE, {
    page: params.page || 1,
    limit: params.perPage || 20,
    filters,
    sort: { field: "created_at", order: "desc" },
  });

  return {
    data: result.data,
    total: result.total,
    page: result.page,
    perPage: result.limit,
    totalPages: result.totalPages,
  };
}

export async function getProgram(
  orgId: number,
  id: string,
): Promise<NominationProgram> {
  const db = getDB();
  const program = await db.findOne<NominationProgram>(PROGRAMS_TABLE, {
    id,
    organization_id: orgId,
  });
  if (!program) throw new NotFoundError("Nomination Program", id);
  return program;
}

export async function updateProgram(
  orgId: number,
  id: string,
  data: Partial<CreateProgramData>,
): Promise<NominationProgram> {
  const db = getDB();
  const existing = await db.findOne<NominationProgram>(PROGRAMS_TABLE, {
    id,
    organization_id: orgId,
  });
  if (!existing) throw new NotFoundError("Nomination Program", id);

  const updated = await db.update<NominationProgram>(PROGRAMS_TABLE, id, data);
  logger.info(`Nomination program updated: ${id} for org ${orgId}`);
  return updated;
}

// ---------------------------------------------------------------------------
// Nominations
// ---------------------------------------------------------------------------

export async function submitNomination(
  orgId: number,
  nominatorId: number,
  data: SubmitNominationData,
): Promise<Nomination> {
  const db = getDB();

  // 1. Validate program exists and is active
  const program = await db.findOne<NominationProgram>(PROGRAMS_TABLE, {
    id: data.program_id,
    organization_id: orgId,
    is_active: true,
  });
  if (!program) throw new NotFoundError("Nomination Program", data.program_id);

  // 2. Cannot nominate yourself
  if (nominatorId === data.nominee_id) {
    throw new ValidationError("You cannot nominate yourself");
  }

  // 3. Check nomination limit per user for this program
  const existingCount = await db.count(NOMINATIONS_TABLE, {
    organization_id: orgId,
    program_id: data.program_id,
    nominator_id: nominatorId,
  });
  if (existingCount >= program.nominations_per_user) {
    throw new ValidationError(
      `You have already used all ${program.nominations_per_user} nomination(s) for this program`,
    );
  }

  // 4. Check for duplicate nomination (same nominator + nominee + program)
  const duplicate = await db.findOne<Nomination>(NOMINATIONS_TABLE, {
    organization_id: orgId,
    program_id: data.program_id,
    nominator_id: nominatorId,
    nominee_id: data.nominee_id,
  });
  if (duplicate) {
    throw new ValidationError(
      "You have already nominated this person for this program",
    );
  }

  const nomination = await db.create<Nomination>(NOMINATIONS_TABLE, {
    organization_id: orgId,
    program_id: data.program_id,
    nominator_id: nominatorId,
    nominee_id: data.nominee_id,
    reason: data.reason,
    status: "submitted" as NominationStatus,
  });

  logger.info(
    `Nomination submitted: ${nomination.id} by user ${nominatorId} for user ${data.nominee_id}`,
  );
  return nomination;
}

export async function listNominations(
  orgId: number,
  params: ListNominationsParams = {},
): Promise<PaginatedResponse<Nomination>> {
  const db = getDB();
  const filters: Record<string, any> = { organization_id: orgId };

  if (params.programId) filters.program_id = params.programId;
  if (params.status) filters.status = params.status;

  const result = await db.findMany<Nomination>(NOMINATIONS_TABLE, {
    page: params.page || 1,
    limit: params.perPage || 20,
    filters,
    sort: params.sort
      ? { field: params.sort, order: params.order || "desc" }
      : { field: "created_at", order: "desc" },
  });

  return {
    data: result.data,
    total: result.total,
    page: result.page,
    perPage: result.limit,
    totalPages: result.totalPages,
  };
}

export async function reviewNomination(
  orgId: number,
  id: string,
  status: "selected" | "not_selected",
  reviewedBy: number,
  reviewNote?: string,
): Promise<Nomination> {
  const db = getDB();
  const nomination = await db.findOne<Nomination>(NOMINATIONS_TABLE, {
    id,
    organization_id: orgId,
  });
  if (!nomination) throw new NotFoundError("Nomination", id);

  if (nomination.status !== "submitted" && nomination.status !== "under_review") {
    throw new ValidationError(
      `Cannot review a nomination with status '${nomination.status}'`,
    );
  }

  const updated = await db.update<Nomination>(NOMINATIONS_TABLE, id, {
    status: status as NominationStatus,
    reviewed_by: reviewedBy,
    review_note: reviewNote || null,
  } as any);

  // If selected, award points + badge
  if (status === "selected") {
    const program = await db.findOne<NominationProgram>(PROGRAMS_TABLE, {
      id: nomination.program_id,
      organization_id: orgId,
    });

    if (program && program.points_awarded > 0) {
      // Award points to nominee
      const balance = await db.findOne<PointBalance>(BALANCES_TABLE, {
        organization_id: orgId,
        user_id: nomination.nominee_id,
      });

      const currentBalance = balance?.current_balance ?? 0;
      const newBalance = currentBalance + program.points_awarded;
      const newTotalEarned = (balance?.total_earned ?? 0) + program.points_awarded;

      if (balance) {
        await db.update(BALANCES_TABLE, balance.id, {
          current_balance: newBalance,
          total_earned: newTotalEarned,
        });
      } else {
        await db.create(BALANCES_TABLE, {
          organization_id: orgId,
          user_id: nomination.nominee_id,
          total_earned: program.points_awarded,
          total_redeemed: 0,
          current_balance: program.points_awarded,
        });
      }

      // Record point transaction
      await db.create(TRANSACTIONS_TABLE, {
        organization_id: orgId,
        user_id: nomination.nominee_id,
        type: "nomination_award",
        amount: program.points_awarded,
        balance_after: newBalance,
        reference_id: nomination.id,
        reference_type: "nomination",
        description: `Selected for: ${program.name}`,
        created_by: reviewedBy,
      });

      logger.info(
        `Awarded ${program.points_awarded} points to user ${nomination.nominee_id} for nomination ${id}`,
      );
    }
  }

  logger.info(`Nomination ${id} reviewed as '${status}' by user ${reviewedBy}`);
  return updated;
}
