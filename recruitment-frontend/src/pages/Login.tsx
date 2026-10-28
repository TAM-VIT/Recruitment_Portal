import { useEffect, useState } from "react";
import { api, ApiError, errorText, isStudentEmail, STUDENT_EMAIL_DOMAIN, type Domain, type DomainInfo, type RecruitmentInfo } from "../api";
import { Alert, Countdown, DomainChecks } from "../components";

type Mode = "login" | "signup";
const RESEND_AFTER = 30; // seconds

export default function Login({
  info,
  notice,
  onSignedIn,
}: {
  info: RecruitmentInfo | null;
  notice: string | null;
  onSignedIn: (token: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null); // set once a code was sent
  const [testCode, setTestCode] = useState<string | null>(null); // test deployments only
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainList, setDomainList] = useState<DomainInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (mode !== "signup" || domainList.length) return;
    api.domains().then((r) => setDomainList(r.domains)).catch((e) => setError(errorText(e)));
  }, [mode, domainList.length]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const fail = (e: unknown) => {
    setError(errorText(e));
    setErrorCode(e instanceof ApiError ? e.code : undefined);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setOtpToken(null);
    setOtp("");
    setError(null);
    setErrorCode(undefined);
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setErrorCode(undefined);
    if (!isStudentEmail(email)) {
      setError(`Please use your @${STUDENT_EMAIL_DOMAIN} email.`);
      return;
    }
    setBusy(true);
    try {
      const r = await api.requestOtp(email.trim().toLowerCase(), mode);
      setOtpToken(r.otpToken);
      setTestCode(r.testCode ?? null);
      setOtp("");
      setWait(RESEND_AFTER);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken) return;
    setError(null);
    setErrorCode(undefined);
    setBusy(true);
    try {
      const addr = email.trim().toLowerCase();
      const r =
        mode === "login"
          ? await api.login(addr, otpToken, otp)
          : await api.signup({ email: addr, otpToken, otp, name, phone, regNumber, domains });
      await onSignedIn(r.token);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  return (
    <div className="center">
      <div className="auth">
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1>Recruitment Portal</h1>
          <p className="muted small">{info ? <Countdown info={info} /> : "Sign in with your VIT email"}</p>
        </div>

        <div className="card">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
              Log in
            </button>
            <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>
              Sign up
            </button>
          </div>

          <Alert kind="info">{notice}</Alert>
          {error && (
            <Alert>
              {error}
              {errorCode === "NOT_REGISTERED" && (
                <> <button className="btn ghost" onClick={() => switchMode("signup")}>Sign up instead</button></>
              )}
              {errorCode === "ALREADY_REGISTERED" && (
                <> <button className="btn ghost" onClick={() => switchMode("login")}>Log in instead</button></>
              )}
            </Alert>
          )}

          {!otpToken ? (
            <form onSubmit={sendCode} noValidate>
              <label className="field">
                <span>VIT email</span>
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder={`name@${STUDENT_EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <small>Only @{STUDENT_EMAIL_DOMAIN} emails can {mode === "login" ? "log in" : "sign up"}.</small>
              </label>
              <button className="btn block" disabled={busy || !email}>
                {busy ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} noValidate>
              {testCode ? (
                <Alert kind="warn">
                  Test mode: emails aren't sent. Your code is <b>{testCode}</b>.
                </Alert>
              ) : (
                <Alert kind="ok">
                  We sent a 6-digit code to <b>{email.trim().toLowerCase()}</b>. It works for 10 minutes.
                  {import.meta.env.DEV && <><br /><span className="small">No email set up? The code is printed in the backend terminal.</span></>}
                </Alert>
              )}
              <label className="field">
                <span>Code</span>
                <input
                  className="code-input"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="••••••"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                />
              </label>

              {mode === "signup" && (
                <>
                  <label className="field">
                    <span>Full name</span>
                    <input type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Phone</span>
                    <input type="tel" inputMode="tel" autoComplete="tel" placeholder="10 digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </label>
                  <label className="field">
                    <span>Registration number</span>
                    <input type="text" autoCapitalize="characters" placeholder="e.g. 24BCE1234" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
                  </label>
                  <div className="field">
                    <span>Domains you want to apply to</span>
                    <DomainChecks domains={domainList} value={domains} onChange={setDomains} />
                  </div>
                </>
              )}

              <button className="btn block" disabled={busy || otp.length !== 6}>
                {busy ? "Checking…" : mode === "login" ? "Log in" : "Create account"}
              </button>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => setOtpToken(null)}>
                  Change email
                </button>
                <button type="button" className="btn ghost" disabled={wait > 0 || busy} onClick={() => sendCode()}>
                  {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
