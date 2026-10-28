import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env variable: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 5000),
  jwtSecret: required("JWT_SECRET"),
  otpSecret: required("OTP_SECRET"),
  googleClientId: required("GOOGLE_CLIENT_ID"),
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  allowedEmailDomains: (process.env.ALLOWED_EMAIL_DOMAINS ?? "vitstudent.ac.in")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
};