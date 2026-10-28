import { useCallback, useEffect, useState } from "react";
import { errorText, type Domain, type DomainInfo, type RecruitmentInfo } from "./api";

// Time left until the form deadline, ticking every minute
export function Countdown({ info }: { info: RecruitmentInfo }) {
  const deadline = new Date(info.formDeadline).getTime();
  // correct for a wrong clock on the student's device
  const [offset] = useState(() => new Date(info.serverTime).getTime() - Date.now());
  const [now, setNow] = useState(() => Date.now() + offset);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 30_000);
    return () => clearInterval(t);
  }, [offset]);

  if (!info.isOpen) return <>Applications closed</>;
  const ms = deadline - now;
  if (ms <= 0) return <>Deadline passed</>;
  const d = Math.floor(ms / 86_400_000);
  const h = Math.floor((ms % 86_400_000) / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return <>{d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`} left to apply</>;
}

export function Alert({ kind = "error", children }: { kind?: "error" | "ok" | "info" | "warn"; children: React.ReactNode }) {
  if (!children) return null;
  return (
    <div className={`alert ${kind}`} role={kind === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Loading() {
  return <div className="spinner">Loading…</div>;
}

// Loads data once and gives a reload function; error is a readable message
export function useLoad<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    try {
      setData(await load());
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload]);
  return { data, error, reload };
}

// Tick boxes for choosing domains
export function DomainChecks({
  domains,
  value,
  onChange,
  locked = [],
}: {
  domains: DomainInfo[];
  value: Domain[];
  onChange: (v: Domain[]) => void;
  locked?: Domain[];
}) {
  return (
    <div className="checks">
      {domains.map((d) => {
        const on = value.includes(d.domain);
        const isLocked = locked.includes(d.domain);
        return (
          <label key={d.domain} className={`check ${on ? "on" : ""}`} title={isLocked ? "Already submitted, can't be removed" : undefined}>
            <input
              type="checkbox"
              checked={on}
              disabled={isLocked}
              onChange={() => onChange(on ? value.filter((x) => x !== d.domain) : [...value, d.domain])}
            />
            {d.label}
          </label>
        );
      })}
    </div>
  );
}
