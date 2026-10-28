import { Router } from "express";
import { config as appConfig } from "../config";
import { prisma } from "../prisma";
import { asyncHandler } from "../middleware/error";
import { getConfig } from "../utils/recruitment";
import { ALL_DOMAINS, DOMAIN_LABELS } from "../utils/domains";

const router = Router();

// GET /api/domains -> domain checklist on the sign up page
router.get(
  "/domains",
  asyncHandler(async (_req, res) => {
    const subsections = await prisma.subsection.findMany({ orderBy: { order: "asc" } });
    const domains = ALL_DOMAINS.map((d) => ({
      domain: d,
      label: DOMAIN_LABELS[d],
      subsections: subsections.filter((s) => s.domain === d).map((s) => ({ id: s.id, name: s.name })),
    }));
    res.json({ domains });
  })
);

// GET /api/config -> countdown timer data
router.get(
  "/config",
  asyncHandler(async (_req, res) => {
    const config = await getConfig();
    const now = Date.now();
    res.json({
      isOpen: config.isOpen,
      formDeadline: config.formDeadline,
      serverTime: new Date(now).toISOString(),
      msRemaining: Math.max(0, config.formDeadline.getTime() - now),
      testTools: appConfig.testTools, // lets a test frontend show its test-only buttons
    });
  })
);

export default router;