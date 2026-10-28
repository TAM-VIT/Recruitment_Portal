import { sendEmail } from "../emailer";
import { HttpError } from "../errors";

// Uses the shared emailer module (src/emailer), so there is one set of email settings:
// EMAIL_USER, EMAIL_APP_PASSWORD and optionally EMAIL_FROM
const configured = !!process.env.EMAIL_USER && !!process.env.EMAIL_APP_PASSWORD;

export async function sendMail(to: string, subject: string, text: string) {
  if (!configured) {
    // development only: print the email instead of sending it
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n[DEV EMAIL] to: ${to}\n${subject}\n${text}\n`);
      return;
    }
    throw new HttpError(503, "Email service is not configured", "EMAIL_NOT_CONFIGURED");
  }
  try {
    await sendEmail({ to, subject, text });
  } catch (e) {
    console.error("Email failed", e);
    throw new HttpError(502, "Couldn't send the email. Please try again.", "EMAIL_FAILED");
  }
}
