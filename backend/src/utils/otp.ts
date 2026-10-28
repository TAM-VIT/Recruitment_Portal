import crypto from "crypto";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { HttpError } from "../errors";

export type OtpPurpose = "signup" | "reset";
const OTP_TTL_SECONDS = 10 * 60;

function mac(email: string, purpose: string, code: string, extra: string) {
  return crypto
    .createHmac("sha256", config.otpSecret)
    .update(`${email}|${purpose}|${code}|${extra}`)
    .digest("hex");
}

// The code goes to the student's email. The token goes back to the browser.
// Nothing is stored in the database.
export function createOtp(email: string, purpose: OtpPurpose, extra = "") {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const otpToken = jwt.sign(
    { email, purpose, h: mac(email, purpose, code, extra) },
    config.otpSecret,
    { expiresIn: OTP_TTL_SECONDS, algorithm: "HS256" }
  );
  return { code, otpToken };
}

export function verifyOtp(otpToken: string, code: string, email: string, purpose: OtpPurpose, extra = "") {
  let p: { email: string; purpose: string; h: string };
  try {
    p = jwt.verify(otpToken, config.otpSecret, { algorithms: ["HS256"] }) as typeof p;
  } catch {
    throw new HttpError(400, "This code has expired. Please request a new one.", "OTP_EXPIRED");
  }
  if (p.email !== email || p.purpose !== purpose) {
    throw new HttpError(400, "Invalid code", "OTP_INVALID");
  }
  const expected = Buffer.from(mac(email, purpose, code, extra));
  const actual = Buffer.from(p.h);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    throw new HttpError(400, "Invalid code", "OTP_INVALID");
  }
}