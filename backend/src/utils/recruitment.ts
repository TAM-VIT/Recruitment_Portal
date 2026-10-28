import type { Application, DomainType, RecruitmentConfig } from "@prisma/client";
import { prisma } from "../prisma";
import { HttpError } from "../errors";
import { SLOT_ACCESS_STAGES } from "./stages";

export async function getConfig(): Promise<RecruitmentConfig> {
  const config = await prisma.recruitmentConfig.findUnique({ where: { key: "main" } });
  if (!config) throw new HttpError(503, "Recruitment is not configured yet", "NOT_CONFIGURED");
  return config;
}

export function applicationState(config: RecruitmentConfig, app: Application) {
  const deadlinePassed = new Date() > config.formDeadline;
  const submitted = !!app.submittedAt;
  return {
    submitted,
    deadlinePassed,
    editable: config.isOpen && !deadlinePassed && !submitted,
  };
}

export function assertEditable(config: RecruitmentConfig, app: Application) {
  const s = applicationState(config, app);
  if (!config.isOpen) throw new HttpError(403, "Applications are closed", "FORM_CLOSED");
  if (s.deadlinePassed) throw new HttpError(403, "The deadline has passed", "DEADLINE_PASSED");
  if (s.submitted) throw new HttpError(409, "Form already submitted", "ALREADY_SUBMITTED");
}

// New sign ups stop when recruitment is closed or the form deadline has passed
export function assertSignupOpen(config: RecruitmentConfig) {
  if (!config.isOpen) throw new HttpError(403, "Applications are closed", "FORM_CLOSED");
  if (new Date() > config.formDeadline) throw new HttpError(403, "The deadline has passed", "DEADLINE_PASSED");
}

// The candidate's application for one domain
export async function getApplication(userId: string, domain: DomainType) {
  const app = await prisma.application.findUnique({
    where: { userId_domain: { userId, domain } },
  });
  if (!app) throw new HttpError(404, "You haven't applied to this domain", "NOT_APPLIED");
  return app;
}

// Only shortlisted candidates can use slot choosing
export function assertSlotAccess(app: Application) {
  if (!SLOT_ACCESS_STAGES.includes(app.stage)) {
    throw new HttpError(403, "Slot choosing opens after you are shortlisted", "NOT_SHORTLISTED");
  }
}