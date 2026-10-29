import { useEffect, useState } from "react";
import { api, ApiError, errorText, isStudentEmail, STUDENT_EMAIL_DOMAIN, type Domain, type DomainInfo, type RecruitmentInfo } from "../api";
import { Alert, Countdown, DomainChecks } from "../components";

// login: email + password · signup and reset: email → 6-digit code → details / new password
type Mode = "login" | "signup" | "reset";
const RESEND_AFTER = 30; // seconds
const MIN_PASSWORD = 8;

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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
  const [success, setSuccess] = useState<string | null>(null);
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

  const addr = email.trim().toLowerCase();

  const clearMessages = () => {
    setError(null);
    setErrorCode(undefined);
    setSuccess(null);
  };

  const fail = (e: unknown) => {
    setError(errorText(e));
    setErrorCode(e instanceof ApiError ? e.code : undefined);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setOtpToken(null);
    setTestCode(null);
    setOtp("");
    setPassword("");
    setConfirm("");
    clearMessages();
  };

  const checkEmail = () => {
    if (isStudentEmail(email)) return true;
    setError(`Please use your @${STUDENT_EMAIL_DOMAIN} email.`);
    return false;
  };

  // checked here so the student sees the problem before the code is used up
  const checkNewPassword = () => {
    if (password.length < MIN_PASSWORD) {
      setError(`Use at least ${MIN_PASSWORD} characters for your password.`);
      return false;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return false;
    }
    return true;
  };

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (!checkEmail()) return;
    setBusy(true);
    try {
      const r = await api.login(addr, password);
      await onSignedIn(r.token);
    } catch (err) {
      fail(err);
      setBusy(false);
    }
  };

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    clearMessages();
    if (!checkEmail()) return;
    setBusy(true);
    try {
      const r = await api.requestOtp(addr, mode === "signup" ? "signup" : "reset");
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

  const finish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpToken) return;
    clearMessages();
    if (!checkNewPassword()) return;
    setBusy(true);
    try {
      if (mode === "signup") {
        const r = await api.signup({ email: addr, otpToken, otp, password, name, phone, regNumber, domains });
        await onSignedIn(r.token);
        return;
      }
      await api.resetPassword(addr, otpToken, otp, password);
      switchMode("login");
      setSuccess("Password changed. Log in with your new password.");
    } catch (err) {
      fail(err);
    }
    setBusy(false);
  };

  const passwordInputs = (label: string) => (
    <>
      <label className="field">
        <span>{label}</span>
        <input
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <small>At least {MIN_PASSWORD} characters.</small>
      </label>
      <label className="field">
        <span>Confirm password</span>
        <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <ShowPassword on={showPassword} onChange={setShowPassword} />
    </>
  );

  return (
    <div className="center">
      <div className="auth">
        <div style={{ textAlign: "center", marginBottom: 16 }}>
          <h1>Recruitment Portal</h1>
          <p className="muted small">{info ? <Countdown info={info} /> : "Sign in with your VIT email"}</p>
        </div>

        <div className="card">
          {mode === "reset" ? (
            <div className="card-head">
              <h2>Reset password</h2>
              <button className="btn ghost" onClick={() => switchMode("login")}>Back to log in</button>
            </div>
          ) : (
            <div className="segmented" role="tablist">
              <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "active" : ""} onClick={() => switchMode("login")}>
                Log in
              </button>
              <button role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "active" : ""} onClick={() => switchMode("signup")}>
                Sign up
              </button>
            </div>
          )}

          <Alert kind="info">{notice}</Alert>
          {success && <Alert kind="ok">{success}</Alert>}
          {error && (
            <Alert>
              {error}
              {errorCode === "ALREADY_REGISTERED" && (
                <> <button className="btn ghost" onClick={() => switchMode("login")}>Log in instead</button></>
              )}
              {errorCode === "INVALID_CREDENTIALS" && (
                <> <button className="btn ghost" onClick={() => switchMode("reset")}>Forgot password?</button></>
              )}
            </Alert>
          )}

          {mode === "login" ? (
            <form onSubmit={login} noValidate>
              <EmailField email={email} setEmail={setEmail} />
              <label className="field">
                <span>Password</span>
                <input type={showPassword ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <ShowPassword on={showPassword} onChange={setShowPassword} />
              <button className="btn block" disabled={busy || !email || !password}>
                {busy ? "Logging in…" : "Log in"}
              </button>
              <div style={{ textAlign: "center", marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => switchMode("reset")}>Forgot password?</button>
              </div>
            </form>
          ) : !otpToken ? (
            <form onSubmit={sendCode} noValidate>
              <p className="small muted">
                {mode === "signup"
                  ? "We'll email you a 6-digit code to check it's your email. Then you'll set a password."
                  : "We'll email you a 6-digit code. Then you can choose a new password."}
              </p>
              <EmailField email={email} setEmail={setEmail} />
              <button className="btn block" disabled={busy || !email}>
                {busy ? "Sending…" : "Send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={finish} noValidate>
              {testCode ? (
                <Alert kind="warn">Test mode: emails aren't sent. Your code is <b>{testCode}</b>.</Alert>
              ) : (
                <Alert kind="ok">
                  {mode === "reset" ? "If there's an account for " : "We sent a 6-digit code to "}
                  <b>{addr}</b>
                  {mode === "reset" ? ", we sent it a 6-digit code." : "."} It works for 10 minutes.
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

              {passwordInputs(mode === "signup" ? "Set a password" : "New password")}

              <button className="btn block" disabled={busy || otp.length !== 6}>
                {busy ? "Saving…" : mode === "signup" ? "Create account" : "Change password"}
              </button>
              <div className="row" style={{ justifyContent: "space-between", marginTop: 8 }}>
                <button type="button" className="btn ghost" onClick={() => { setOtpToken(null); setTestCode(null); }}>
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

function EmailField({ email, setEmail }: { email: string; setEmail: (v: string) => void }) {
  return (
    <label className="field">
      <span>VIT email</span>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={`name@${STUDENT_EMAIL_DOMAIN}`}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <small>Only @{STUDENT_EMAIL_DOMAIN} emails.</small>
    </label>
  );
}

function ShowPassword({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row small muted" style={{ marginBottom: 14, cursor: "pointer" }}>
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} style={{ width: 18, height: 18 }} />
      Show password
    </label>
  );
}
