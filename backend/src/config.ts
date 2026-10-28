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
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((s) => s.trim()),
  // test-only helpers (e.g. setting a stage without the admin backend). Never on in production
  testTools: process.env.ENABLE_TEST_TOOLS === "true" && process.env.NODE_ENV !== "production",
};

// Only VIT student emails can sign up or log in
export const STUDENT_EMAIL_DOMAIN = "vitstudent.ac.in";

export const isStudentEmail = (email: string) => email.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);