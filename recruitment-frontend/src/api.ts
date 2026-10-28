// Every call to the recruitment backend goes through this file.
// In development "/api" is forwarded to the backend by vite.config.ts.
const BASE = import.meta.env.VITE_API_URL ?? "/api";
const TOKEN_KEY = "recruitment-token";

export const STUDENT_EMAIL_DOMAIN = "vitstudent.ac.in";
export const isStudentEmail = (email: string) =>
  email.trim().toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);

export type Domain = "TECHNICAL" | "MANAGEMENT" | "DESIGN" | "MARKETING" | "R_AND_D" | "EDITORIAL";
export type Stage = "FORM_FILLING" | "SHORTLISTED" | "SLOT_CHOOSING" | "INTERVIEW" | "SELECTED" | "REJECTED";
export const ALL_STAGES: Stage[] = ["FORM_FILLING", "SHORTLISTED", "SLOT_CHOOSING", "INTERVIEW", "SELECTED", "REJECTED"];

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  regNumber: string;
}
export interface AppSummary {
  domain: Domain;
  label: string;
  stage: Stage;
  submitted: boolean;
}
export interface RecruitmentInfo {
  isOpen: boolean;
  formDeadline: string;
  serverTime: string;
  msRemaining: number;
  testTools?: boolean;
}
export interface DomainInfo {
  domain: Domain;
  label: string;
  subsections: { id: string; name: string }[];
}
export interface Question {
  id: string;
  subsectionId: string | null;
  text: string;
  required: boolean;
  maxLength: number;
  answer: string;
  savedAt: string | null;
}
export interface FormApplication {
  domain: Domain;
  label: string;
  stage: Stage;
  submitted: boolean;
  deadlinePassed: boolean;
  editable: boolean;
  progress: { requiredAnswered: number; requiredTotal: number };
  subsections: { id: string; name: string }[];
  questions: Question[];
}
export interface SlotTime {
  startTime: string;
  endTime: string;
  meetingLink: string | null;
}
export interface StatusApplication {
  domain: Domain;
  label: string;
  stage: Stage;
  currentIndex: number | null;
  rejected: boolean;
  submitted: boolean;
  deadlinePassed: boolean;
  editable: boolean;
  canChooseSlots: boolean;
  booking: { id: string; slot: SlotTime } | null;
}
export interface StatusResponse {
  stages: { key: Stage; label: string; order: number }[];
  formDeadline: string;
  applications: StatusApplication[];
}
export interface CalendarDay {
  date: string;
  totalSlots: number;
  availableSlots: number;
}
export interface DaySlot {
  id: string;
  startTime: string;
  endTime: string;
  remaining: number;
  bookedByMe: boolean;
}
export interface Booking {
  id: string;
  slot: SlotTime & { domain: Domain };
}

// An error from the backend: message is shown to the user, code says which rule failed
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}
export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // private window: the token only lasts until the page reloads
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError("Can't reach the backend. Is it running?", 0, "NETWORK");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(data.error ?? `Request failed (${res.status})`, res.status, data.code, data.details);
  }
  return data as T;
}

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
const put = (body: unknown) => ({ method: "PUT", body: JSON.stringify(body) });

export const api = {
  config: () => request<RecruitmentInfo>("/config"),
  domains: () => request<{ domains: DomainInfo[] }>("/domains"),

  requestOtp: (email: string, purpose: "signup" | "login") =>
    request<{ sent: boolean; otpToken: string }>("/auth/request-otp", post({ email, purpose })),
  signup: (body: {
    email: string;
    otpToken: string;
    otp: string;
    name: string;
    phone: string;
    regNumber: string;
    domains: Domain[];
  }) => request<{ token: string; user: User }>("/auth/signup", post(body)),
  login: (email: string, otpToken: string, otp: string) =>
    request<{ token: string; user: User }>("/auth/login", post({ email, otpToken, otp })),

  me: () => request<{ registered: boolean; user?: User; applications?: AppSummary[] }>("/me"),
  updateMe: (body: Partial<{ name: string; phone: string; regNumber: string; domains: Domain[] }>) =>
    request<{ user: User; applications: AppSummary[] }>("/me", put(body)),

  form: () => request<{ isOpen: boolean; formDeadline: string; applications: FormApplication[] }>("/form"),
  saveAnswer: (questionId: string, text: string) =>
    request<{ questionId: string; savedAt: string }>("/form/answers", put({ questionId, text })),
  submit: (domain: Domain) => request<{ submitted: boolean }>("/form/submit", post({ domain })),

  status: () => request<StatusResponse>("/status"),

  calendar: (domain: Domain, month: string) =>
    request<{ month: string; days: CalendarDay[] }>(`/slots/calendar?domain=${domain}&month=${month}`),
  daySlots: (domain: Domain, date: string) =>
    request<{ date: string; slots: DaySlot[] }>(`/slots?domain=${domain}&date=${date}`),
  bookings: () => request<{ bookings: Booking[] }>("/slots/book"),
  book: (slotId: string) => request<{ meetingLink: string | null }>("/slots/book", post({ slotId })),
  cancel: (bookingId: string) => request<{ cancelled: boolean }>(`/slots/book?bookingId=${bookingId}`, { method: "DELETE" }),

  // test-only, works when the backend has ENABLE_TEST_TOOLS=true
  setStage: (domain: Domain, stage: Stage) => request<{ stage: Stage }>("/test/stage", post({ domain, stage })),
};

// ---------- formatting (all times shown in India time) ----------
const IST = "Asia/Kolkata";
export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: IST, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
export const fmtTime = (iso: string) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: IST, timeStyle: "short" }).format(new Date(iso));
export const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: IST }).format(new Date()); // YYYY-MM-DD

export const STAGE_LABELS: Record<Stage, string> = {
  FORM_FILLING: "Form filling",
  SHORTLISTED: "Shortlisted",
  SLOT_CHOOSING: "Slot choosing",
  INTERVIEW: "Interview",
  SELECTED: "Selected",
  REJECTED: "Rejected",
};

// Turns a validation error's field list into one readable line
export function errorText(e: unknown): string {
  if (!(e instanceof ApiError)) return "Something went wrong.";
  if (e.code === "VALIDATION_ERROR" && e.details) {
    const parts = Object.entries(e.details as Record<string, string[] | undefined>)
      .filter(([, v]) => v?.length)
      .map(([k, v]) => `${k}: ${v![0]}`);
    if (parts.length) return parts.join(" · ");
  }
  const missing = (e.details as { missing?: { text: string }[] } | undefined)?.missing;
  if (e.code === "INCOMPLETE_FORM" && missing) {
    return `${e.message}: ${missing.map((q) => `"${q.text}"`).join(", ")}`;
  }
  return e.message;
}
