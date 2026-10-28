import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { User } from "@prisma/client";
import { config, isStudentEmail } from "../config";
import { prisma } from "../prisma";
import { HttpError } from "../errors";
import { asyncHandler } from "./error";

export interface AuthPayload {
  email: string;
  name: string;
  picture: string | null;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
      user?: User;
    }
  }
}

// Checks the "Authorization: Bearer <token>" header
export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Not authenticated", "UNAUTHENTICATED"));
  }
  try {
    const p = jwt.verify(header.slice(7), config.jwtSecret) as AuthPayload;
    if (!isStudentEmail(p.email)) {
      return next(new HttpError(403, "Please use your @vitstudent.ac.in email", "EMAIL_NOT_ALLOWED"));
    }
    req.auth = { email: p.email, name: p.name, picture: p.picture ?? null };
    next();
  } catch {
    next(new HttpError(401, "Session expired, please sign in again", "INVALID_TOKEN"));
  }
};

const loadUser: RequestHandler = asyncHandler(async (req, _res, next) => {
  const user = await prisma.user.findUnique({ where: { email: req.auth!.email } });
  if (!user) throw new HttpError(404, "Complete sign up first", "NOT_REGISTERED");
  req.user = user;
  next();
});

// Signed in AND finished the sign up details
export const requireUser: RequestHandler[] = [requireAuth, loadUser];