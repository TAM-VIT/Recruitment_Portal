import { Router } from "express";
import { prisma } from "../prisma";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/error";
import { requireUser } from "../middleware/auth";
import { saveAnswerSchema, submitFormSchema } from "../utils/validators";
import { applicationState, assertEditable, getApplication, getConfig } from "../utils/recruitment";
import { DOMAIN_LABELS } from "../utils/domains";

const router = Router();
router.use(...requireUser);

// GET /api/form -> every domain the candidate applied to, with questions and saved answers
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const config = await getConfig();

    const applications = await prisma.application.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    const domains = applications.map((a) => a.domain);

    const [subsections, questions, answers] = await Promise.all([
      prisma.subsection.findMany({ where: { domain: { in: domains } }, orderBy: { order: "asc" } }),
      prisma.question.findMany({ where: { domain: { in: domains } }, orderBy: { order: "asc" } }),
      prisma.answer.findMany({ where: { userId: user.id } }),
    ]);
    const byQuestion = new Map(answers.map((a) => [a.questionId, a]));
    const now = Date.now();

    res.json({
      isOpen: config.isOpen,
      formDeadline: config.formDeadline,
      serverTime: new Date(now).toISOString(),
      msRemaining: Math.max(0, config.formDeadline.getTime() - now),
      applications: applications.map((app) => {
        let requiredTotal = 0;
        let requiredAnswered = 0;
        const items = questions
          .filter((q) => q.domain === app.domain)
          .map((q) => {
            const a = byQuestion.get(q.id);
            if (q.required) {
              requiredTotal++;
              if (a && a.text.trim()) requiredAnswered++;
            }
            return {
              id: q.id,
              subsectionId: q.subsectionId,
              text: q.text,
              required: q.required,
              maxLength: q.maxLength,
              answer: a?.text ?? "",
              savedAt: a?.updatedAt ?? null,
            };
          });
        return {
          domain: app.domain,
          label: DOMAIN_LABELS[app.domain],
          stage: app.stage,
          ...applicationState(config, app),
          progress: { requiredAnswered, requiredTotal },
          subsections: subsections
            .filter((s) => s.domain === app.domain)
            .map((s) => ({ id: s.id, name: s.name })),
          questions: items,
        };
      }),
    });
  })
);

// PUT /api/form/answers   body: { questionId, text }  -> save button under each question
router.put(
  "/answers",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const config = await getConfig();
    const { questionId, text } = saveAnswerSchema.parse(req.body);

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) throw new HttpError(404, "Question not found", "QUESTION_NOT_FOUND");

    const app = await getApplication(user.id, question.domain);
    assertEditable(config, app);

    if (text.length > question.maxLength) {
      throw new HttpError(400, `Answer exceeds ${question.maxLength} characters`, "ANSWER_TOO_LONG");
    }

    const answer = await prisma.answer.upsert({
      where: { userId_questionId: { userId: user.id, questionId } },
      create: { userId: user.id, questionId, text },
      update: { text },
    });
    res.json({ questionId, savedAt: answer.updatedAt });
  })
);

// POST /api/form/submit   body: { domain } -> final submit for one domain
router.post(
  "/submit",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const config = await getConfig();
    const { domain } = submitFormSchema.parse(req.body);

    const app = await getApplication(user.id, domain);
    assertEditable(config, app);

    const [required, answers] = await Promise.all([
      prisma.question.findMany({
        where: { domain, required: true },
        select: { id: true, text: true },
      }),
      prisma.answer.findMany({ where: { userId: user.id } }),
    ]);
    const answered = new Set(answers.filter((a) => a.text.trim()).map((a) => a.questionId));
    const missing = required.filter((q) => !answered.has(q.id));
    if (missing.length) {
      throw new HttpError(422, "Some required questions are unanswered", "INCOMPLETE_FORM", { missing });
    }

    // protects against double submits. On MongoDB a never-set field isn't matched by `null`,
    // so new applications (no submittedAt field yet) need isSet: false
    const result = await prisma.application.updateMany({
      where: { id: app.id, OR: [{ submittedAt: null }, { submittedAt: { isSet: false } }] },
      data: { submittedAt: new Date() },
    });
    if (result.count === 0) throw new HttpError(409, "Form already submitted", "ALREADY_SUBMITTED");

    res.json({ submitted: true, domain });
  })
);

export default router;