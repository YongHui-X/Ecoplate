import {
  checkReservationTimeouts,
  checkPinExpiry,
  requeuePendingDeliveries,
} from "../services/locker-service";

// Interval timers
let reservationTimeoutInterval: ReturnType<typeof setInterval> | null = null;
let pinExpiryInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start all locker background jobs
 */
export function startLockerJobs() {
  console.log("Starting EcoLocker background jobs...");

  // Check reservation timeouts every minute
  reservationTimeoutInterval = setInterval(async () => {
    try {
      const count = await checkReservationTimeouts();
      if (count > 0) {
        console.log(`[LockerJobs] Cancelled ${count} expired reservations`);
      }
    } catch (err) {
      console.error("[LockerJobs] Error checking reservation timeouts:", err);
    }
  }, 60_000); // Every minute

  // Check PIN expiry every hour
  pinExpiryInterval = setInterval(async () => {
    try {
      const count = await checkPinExpiry();
      if (count > 0) {
        console.log(`[LockerJobs] Expired ${count} unclaimed pickups`);
      }
    } catch (err) {
      console.error("[LockerJobs] Error checking PIN expiry:", err);
    }
  }, 3600_000); // Every hour

  // Re-queue pending deliveries on server restart
  requeuePendingDeliveries()
    .then((count) => {
      if (count > 0) {
        console.log(`[LockerJobs] Re-queued ${count} pending deliveries`);
      }
    })
    .catch((err) => {
      console.error("[LockerJobs] Error re-queuing pending deliveries:", err);
    });

  console.log("EcoLocker background jobs started");
}

/**
 * Stop all locker background jobs
 */
export function stopLockerJobs() {
  if (reservationTimeoutInterval) {
    clearInterval(reservationTimeoutInterval);
    reservationTimeoutInterval = null;
  }

  if (pinExpiryInterval) {
    clearInterval(pinExpiryInterval);
    pinExpiryInterval = null;
  }

  console.log("EcoLocker background jobs stopped");
}
