import { useCallback, useEffect, useState } from "react";
import { api, ApiError, getToken, setToken, type AppSummary, type RecruitmentInfo, type User } from "./api";
import { Countdown } from "./components";
import Login from "./pages/Login";
import Status from "./pages/Status";
import Form from "./pages/Form";
import Slots from "./pages/Slots";
import Profile from "./pages/Profile";

export type Page = "status" | "form" | "slots" | "profile";
const PAGES: { key: Page; label: string; icon: string }[] = [
  { key: "status", label: "Status", icon: "◉" },
  { key: "form", label: "Form", icon: "✎" },
  { key: "slots", label: "Slots", icon: "▦" },
  { key: "profile", label: "Profile", icon: "☺" },
];

// The page lives in the address (#form, #slots ...) so refresh and the back button work
const pageFromHash = (): Page => {
  const h = window.location.hash.slice(1);
  return (PAGES.some((p) => p.key === h) ? h : "status") as Page;
};

export interface Session {
  user: User;
  applications: AppSummary[];
  info: RecruitmentInfo | null;
  refresh: () => Promise<void>;
  go: (page: Page) => void;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<AppSummary[]>([]);
  const [info, setInfo] = useState<RecruitmentInfo | null>(null);
  const [loading, setLoading] = useState(!!getToken());
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(pageFromHash);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    api.config().then(setInfo).catch(() => setInfo(null));
  }, []);

  const logout = useCallback((message?: string) => {
    setToken(null);
    setUser(null);
    setApplications([]);
    setNotice(message ?? null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      if (!me.registered || !me.user) return logout("This account no longer exists. Please sign up again.");
      setUser(me.user);
      setApplications(me.applications ?? []);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) logout(e.message);
      else throw e;
    }
  }, [logout]);

  useEffect(() => {
    if (!getToken()) return;
    refresh()
      .catch(() => setNotice("Can't reach the backend. Is it running?"))
      .finally(() => setLoading(false));
  }, [refresh]);

  const go = (p: Page) => {
    window.location.hash = p;
    window.scrollTo(0, 0);
  };

  if (loading) return <div className="center spinner">Loading…</div>;

  if (!user) {
    return (
      <Login
        info={info}
        notice={notice}
        onSignedIn={async (token) => {
          setToken(token);
          setNotice(null);
          await refresh();
          go("status");
        }}
      />
    );
  }

  const session: Session = { user, applications, info, refresh, go };

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          Recruitment Portal
          <small>{user.name} · {info ? <Countdown info={info} /> : "test frontend"}</small>
        </div>
        <nav className="nav" aria-label="Main">
          {PAGES.map((p) => (
            <button key={p.key} className={page === p.key ? "active" : ""} onClick={() => go(p.key)} aria-current={page === p.key ? "page" : undefined}>
              <span className="icon" aria-hidden="true">{p.icon}</span>
              {p.label}
            </button>
          ))}
        </nav>
        <button className="btn ghost" onClick={() => logout()}>Log out</button>
      </header>
      <main className="page">
        {page === "status" && <Status session={session} />}
        {page === "form" && <Form session={session} />}
        {page === "slots" && <Slots session={session} />}
        {page === "profile" && <Profile session={session} />}
      </main>
    </div>
  );
}
