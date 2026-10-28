import { Router } from "express";
import type { Application } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/error";
import { requireAuth, requireUser } from "../middleware/auth";
import { profileUpdateSchema } from "../utils/validators";
import { getConfig } from "../utils/recruitment";
import { DOMAIN_LABELS } from "../utils/domains";

const router = Router();

const summary = (a: Application) => ({
  domain: a.domain,
  label: DOMAIN_LABELS[a.domain],
  stage: a.stage,
  submitted: !!a.submittedAt,
});

// GET /api/me -> profile page. Returns registered:false if the account no longer exists.
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { email: req.auth!.email } });
    if (!user) {
      res.json({ registered: false });
      return;
    }
    const applications = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ registered: true, user, applications: applications.map(summary) });
  })
);

// PUT /api/me -> edit profile and domains (email can't be changed)
router.put(
  "/me",
  ...requireUser,
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { domains, ...profile } = profileUpdateSchema.parse(req.body);

    if (domains) {
      const config = await getConfig();
      if (!config.isOpen || new Date() > config.formDeadline) {
        throw new HttpError(403, "Domains can't be changed after the deadline", "DOMAINS_LOCKED");
      }
      const existing = await prisma.application.findMany({ where: { userId: user.id } });
      const wanted = new Set(domains);
      const have = new Set(existing.map((a) => a.domain));
      const removing = existing.filter((a) => !wanted.has(a.domain));

      if (removing.some((a) => a.submittedAt || a.stage !== "FORM_FILLING")) {
        throw new HttpError(409, "You can't remove a domain you've already submitted", "DOMAIN_SUBMITTED");
      }

      await prisma.$transaction(async (tx) => {
        if (removing.length) {
          await tx.answer.deleteMany({
            where: { userId: user.id, question: { domain: { in: removing.map((a) => a.domain) } } },
          });
          await tx.application.deleteMany({ where: { id: { in: removing.map((a) => a.id) } } });
        }
        const toAdd = domains.filter((d) => !have.has(d));
        if (toAdd.length) {
          await tx.application.createMany({
            data: toAdd.map((domain) => ({ userId: user.id, domain })),
          });
        }
      });
    }

    const updated = Object.keys(profile).length
      ? await prisma.user.update({ where: { id: user.id }, data: profile })
      : user;
    const applications = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    res.json({ user: updated, applications: applications.map(summary) });
  })
);

export default router;