import crypto from "crypto";

const GENESIS_HASH = "0".repeat(64);

/**
 * Immutable, hash-chained audit trail.
 * Each event's hash = SHA256(previousHash + eventType + JSON(eventData) + timestamp).
 * This makes any retroactive edit to a stored event detectable, because it would
 * break the hash chain for every subsequent entry.
 *
 * NOTE: `prisma` is imported dynamically inside each function (rather than at
 * module scope) so that `computeHash` — the pure, unit-testable part of this
 * module — can be imported by tests/tooling without instantiating a database
 * client.
 */
export async function recordAuditEvent(params: {
  caseId?: string;
  userId?: string;
  eventType: string;
  eventData: Record<string, unknown>;
}) {
  const { prisma } = await import("./prisma");
  const { caseId, userId, eventType, eventData } = params;

  const last = await prisma.auditLog.findFirst({
    orderBy: { timestamp: "desc" },
  });
  const previousHash = last?.hash ?? GENESIS_HASH;
  const timestamp = new Date();

  const hash = computeHash(previousHash, eventType, eventData, timestamp.toISOString());

  return prisma.auditLog.create({
    data: {
      caseId,
      userId,
      eventType,
      eventData: eventData as any,
      previousHash,
      hash,
      timestamp,
    },
  });
}

export function computeHash(
  previousHash: string,
  eventType: string,
  eventData: Record<string, unknown>,
  timestampIso: string
): string {
  const payload = `${previousHash}|${eventType}|${JSON.stringify(eventData)}|${timestampIso}`;
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export interface ChainVerificationResult {
  valid: boolean;
  totalEvents: number;
  brokenAt: string | null;
  message: string;
}

/** Recomputes the full chain and checks every stored hash matches. */
export async function verifyChain(caseId?: string): Promise<ChainVerificationResult> {
  const { prisma } = await import("./prisma");
  // Integrity depends on the FULL global chain (each entry links to the previous
  // entry system-wide), so verification always walks every event, not just one case's.
  const events = await prisma.auditLog.findMany({
    orderBy: { timestamp: "asc" },
  });

  let expectedPrevious = GENESIS_HASH;
  for (const event of events) {
    const recomputed = computeHash(
      expectedPrevious,
      event.eventType,
      event.eventData as Record<string, unknown>,
      event.timestamp.toISOString()
    );
    if (event.previousHash !== expectedPrevious || recomputed !== event.hash) {
      return {
        valid: false,
        totalEvents: events.length,
        brokenAt: event.id,
        message: `INTEGRITY VIOLATION DETECTED — chain break at audit event ${event.id}`,
      };
    }
    expectedPrevious = event.hash;
  }

  return {
    valid: true,
    totalEvents: events.length,
    brokenAt: null,
    message: caseId
      ? `Audit chain intact for case (${events.filter((e: (typeof events)[number]) => e.caseId === caseId).length} related events; full chain of ${events.length} verified).`
      : `Full audit chain intact (${events.length} events verified).`,
  };
}
