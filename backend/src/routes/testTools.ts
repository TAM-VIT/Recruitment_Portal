import { Router } from "express";
import { Stage } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../prisma";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { domainEnum } from "../utils/validators";
import { getApplication } from "../utils/recruitment";

// Test-only helpers. Mounted only when ENABLE_TEST_TOOLS=true and NODE_ENV isn't production
// (see app.ts). They stand in for the admin backend while it's being built.
const router = Router();
router.use(...requireUser);

// POST /api/test/stage   body: { domain, stage } -> set the signed-in student's stage for one domain
// e.g. SHORTLISTED to try slot booking, or SELECTED / REJECTED to see the result on the status page
router.post(
  "/stage",
  asyncHandler(async (req, res) => {
    const { domain, stage } = z.object({ domain: domainEnum, stage: z.nativeEnum(Stage) }).parse(req.body);
    const app = await getApplication(req.user!.id, domain);
    await prisma.application.update({ where: { id: app.id }, data: { stage } });
    res.json({ domain, stage });
  })
);

export default router;
