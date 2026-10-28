import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config, isStudentEmail } from "../config";
import { prisma } from "../prisma";
import { HttpError } from "../errors";
import { asyncHandler } from "../middleware/error";
import { profileSchema } from "../utils/validators";
import { assertSignupOpen, getConfig } from "../utils/recruitment";
import { createOtp, verifyOtp } from "../utils/otp";
import { sendMail } from "../utils/mailer";

const router = Router();

const signToken = (u: { email: string; name: string; image: string | null }) =>
  jwt.sign({ email: u.email, name: u.name, picture: u.image ?? null }, config.jwtSecret, { expiresIn: "7d" });

// ---------- validation ----------
const email = z.string().trim().toLowerCase().email();
const code = z.string().regex(/^\d{6}$/, "Enter the 6 digit code");

const requestOtpSchema = z.object({ email, purpose: z.enum(["signup", "login"]) });
const signupSchema = profileSchema.extend({
  email,
  otpToken: z.string().min(10),
  otp: code,
});
const loginSchema = z.object({ email, otpToken: z.string().min(10), otp: code });

// ---------- rate limits (per account, kept in server memory) ----------
// Not per IP: a whole hostel can share one IP address.
const limited = (windowMs: number, limit: number, message: string) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `email:${String(req.body?.email ?? "").toLowerCase()}`,
    message: { error: message, code: "RATE_LIMITED" },
  });

const otpRequestLimit = limited(10 * 60 * 1000, 3, "Too many codes requested. Try again in a few minutes.");
const otpVerifyLimit = limited(10 * 60 * 1000, 6, "Too many attempts. Try again in a few minutes.");

// ---------- POST /api/auth/request-otp   body: { email, purpose: "signup" | "login" } ----------
router.post(
  "/request-otp",
  otpRequestLimit,
  asyncHandler(async (req, res) => {
    const { email: addr, purpose } = requestOtpSchema.parse(req.body);
    if (!isStudentEmail(addr)) {
      throw new HttpError(403, "Please use your @vitstudent.ac.in email", "EMAIL_NOT_ALLOWED");
    }
    const user = await prisma.user.findUnique({ where: { email: addr } });

    if (purpose === "signup") {
      if (user) throw new HttpError(409, "This email is already registered. Please log in.", "ALREADY_REGISTERED");
      assertSignupOpen(await getConfig());
    }
    if (purpose === "login" && !user) {
      throw new HttpError(404, "No account with this email. Please sign up.", "NOT_REGISTERED");
    }

    const { code: otp, otpToken } = createOtp(addr, purpose);
    await sendMail(
      addr,
      purpose === "signup" ? "Your verification code" : "Your login code",
      `Your code is ${otp}. It expires in 10 minutes.\n\nIf you didn't request it, ignore this email.`
    );
    res.json({ sent: true, otpToken });
  })
);

// ---------- POST /api/auth/signup ----------
// body: { email, otpToken, otp, name, phone, regNumber, domains[] }
router.post(
  "/signup",
  otpVerifyLimit,
  asyncHandler(async (req, res) => {
    const { email: addr, otpToken, otp, domains, ...profile } = signupSchema.parse(req.body);
    if (!isStudentEmail(addr)) {
      throw new HttpError(403, "Please use your @vitstudent.ac.in email", "EMAIL_NOT_ALLOWED");
    }
    verifyOtp(otpToken, otp, addr, "signup");

    assertSignupOpen(await getConfig());

    // a duplicate email or registration number returns 409 DUPLICATE
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { ...profile, email: addr } });
      await tx.application.createMany({
        data: domains.map((domain) => ({ userId: created.id, domain })),
      });
      return created;
    });

    const applications = await prisma.application.findMany({ where: { userId: user.id } });
    res.status(201).json({
      token: signToken(user),
      user,
      applications: applications.map((a) => ({ domain: a.domain, stage: a.stage })),
    });
  })
);

// ---------- POST /api/auth/login   body: { email, otpToken, otp } ----------
router.post(
  "/login",
  otpVerifyLimit,
  asyncHandler(async (req, res) => {
    const { email: addr, otpToken, otp } = loginSchema.parse(req.body);
    verifyOtp(otpToken, otp, addr, "login");

    const user = await prisma.user.findUnique({ where: { email: addr } });
    if (!user) throw new HttpError(404, "No account with this email. Please sign up.", "NOT_REGISTERED");
    res.json({ token: signToken(user), user });
  })
);

export default router;
