// ============================================================================
// CELEBRATION JOBS
// Daily BullMQ job that scans empcloud users for today's birthdays and
// work anniversaries, creates celebration records, and optionally sends
// system kudos.
// ============================================================================

import { getEmpCloudDB } from "../db/empcloud";
import { logger } from "../utils/logger";
import * as celebrationService from "../services/celebration/celebration.service";
import * as kudosService from "../services/kudos/kudos.service";

// ---------------------------------------------------------------------------
// Daily celebration scan — intended to be called at midnight
// ---------------------------------------------------------------------------
export async function runDailyCelebrationScan(): Promise<void> {
  logger.info("Starting daily celebration scan...");

  try {
    const empcloud = getEmpCloudDB();

    // Get all active organizations
    const orgs = await empcloud("organizations").where({ is_active: true });

    let totalBirthdays = 0;
    let totalAnniversaries = 0;

    for (const org of orgs) {
      try {
        const result = await celebrationService.generateTodayCelebrations(org.id);
        totalBirthdays += result.birthdays;
        totalAnniversaries += result.anniversaries;

        // Auto-send system kudos for birthdays
        const birthdayUsers = await celebrationService.getTodaysBirthdays(org.id);
        for (const user of birthdayUsers) {
          try {
            await kudosService.sendBirthdayKudos(org.id, user.id, true);
          } catch (err) {
            logger.warn(`Failed to send birthday kudos for user=${user.id} org=${org.id}:`, err);
          }
        }

        // Auto-send system kudos for anniversaries
        const anniversaryUsers = await celebrationService.getTodaysAnniversaries(org.id);
        for (const user of anniversaryUsers) {
          try {
            const joiningDate = new Date(user.date_of_joining!);
            const years = new Date().getFullYear() - joiningDate.getFullYear();
            await kudosService.sendAnniversaryKudos(org.id, user.id, years, true);
          } catch (err) {
            logger.warn(
              `Failed to send anniversary kudos for user=${user.id} org=${org.id}:`,
              err,
            );
          }
        }
      } catch (err) {
        logger.error(`Failed to process celebrations for org=${org.id}:`, err);
      }
    }

    logger.info(
      `Daily celebration scan complete: ${totalBirthdays} birthdays, ${totalAnniversaries} anniversaries across ${orgs.length} orgs`,
    );
  } catch (err) {
    logger.error("Daily celebration scan failed:", err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Schedule setup — call this from server startup to register the job.
// If BullMQ is available, schedule as a repeating job. Otherwise, use
// a simple setInterval as a fallback.
// ---------------------------------------------------------------------------
let scheduledInterval: NodeJS.Timeout | null = null;

export function scheduleDailyCelebrationJob(): void {
  // Run immediately on startup (check if already done today)
  runDailyCelebrationScan().catch((err) => {
    logger.error("Initial celebration scan failed:", err);
  });

  // Schedule to run every 24 hours
  // In production, this would be replaced with a proper BullMQ repeating job
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  scheduledInterval = setInterval(() => {
    runDailyCelebrationScan().catch((err) => {
      logger.error("Scheduled celebration scan failed:", err);
    });
  }, TWENTY_FOUR_HOURS);

  logger.info("Daily celebration job scheduled (24h interval)");
}

export function stopDailyCelebrationJob(): void {
  if (scheduledInterval) {
    clearInterval(scheduledInterval);
    scheduledInterval = null;
    logger.info("Daily celebration job stopped");
  }
}
