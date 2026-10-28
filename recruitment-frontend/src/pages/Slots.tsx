import { useEffect, useState } from "react";
import type { Session } from "../App";
import { api, errorText, fmtDateTime, fmtTime, istToday, type CalendarDay, type DaySlot, type Domain, type StatusApplication } from "../api";
import { Alert, Loading, useLoad } from "../components";

const CANCEL_CUTOFF_MS = 12 * 60 * 60 * 1000; // the backend refuses cancelling within 12 hours
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default function Slots({ session }: { session: Session }) {
  const { data, error, reload } = useLoad(() => api.status());
  const [domain, setDomain] = useState<Domain | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const open = data?.applications.filter((a) => a.canChooseSlots || a.booking) ?? [];
  useEffect(() => {
    if (!domain && open[0]) setDomain(open[0].domain);
  }, [open, domain]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;

  if (!open.length) {
    return (
      <>
        <h1>Interview slots</h1>
        <Alert kind="info">Slot choosing opens after you're shortlisted for a domain. Check the Status page for updates.</Alert>
        {session.info?.testTools && <p className="small muted">Testing? Use the test tools on the Status page to mark a domain as shortlisted.</p>}
      </>
    );
  }

  const app = open.find((a) => a.domain === domain) ?? open[0];
  const afterChange = async (msg: string) => {
    setMessage(msg);
    await reload();
    await session.refresh();
  };

  return (
    <>
      <h1>Interview slots</h1>
      <div className="chips" role="tablist">
        {open.map((a) => (
          <button key={a.domain} role="tab" aria-selected={a.domain === app.domain} className={`chip ${a.domain === app.domain ? "active" : ""}`} onClick={() => { setDomain(a.domain); setMessage(null); }}>
            {a.label} {a.booking ? "✓" : ""}
          </button>
        ))}
      </div>
      <Alert kind="ok">{message}</Alert>
      {app.booking ? (
        <MyBooking app={app} onCancelled={() => afterChange("Booking cancelled. You can pick another slot.")} />
      ) : (
        <Picker key={app.domain} domain={app.domain} onBooked={(link) => afterChange(link ? `Booked! Your meeting link: ${link}` : "Booked!")} />
      )}
    </>
  );
}

function MyBooking({ app, onCancelled }: { app: StatusApplication; onCancelled: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const b = app.booking!;
  const tooLate = new Date(b.slot.startTime).getTime() - Date.now() < CANCEL_CUTOFF_MS;

  const cancel = async () => {
    if (!window.confirm("Cancel this interview booking?")) return;
    setError(null);
    setBusy(true);
    try {
      await api.cancel(b.id);
      await onCancelled();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2>Your {app.label} interview</h2>
      <p>
        <b>{fmtDateTime(b.slot.startTime)}</b> to {fmtTime(b.slot.endTime)}
      </p>
      {b.slot.meetingLink ? (
        <p><a href={b.slot.meetingLink} target="_blank" rel="noreferrer">Open meeting link</a></p>
      ) : (
        <p className="muted small">The meeting link will appear here when the interviewer adds it.</p>
      )}
      <Alert>{error}</Alert>
      <button className="btn danger" onClick={cancel} disabled={busy || tooLate}>
        {busy ? "Cancelling…" : "Cancel booking"}
      </button>
      {tooLate && <p className="small muted" style={{ marginTop: 8 }}>Bookings can't be cancelled within 12 hours of the interview.</p>}
    </section>
  );
}

function Picker({ domain, onBooked }: { domain: Domain; onBooked: (link: string | null) => Promise<void> }) {
  const today = istToday();
  const [month, setMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [date, setDate] = useState<string | null>(null);
  const cal = useLoad(() => api.calendar(domain, month), [domain, month]);

  const [y, m] = month.split("-").map(Number);
  const shift = (by: number) => {
    const d = new Date(Date.UTC(y, m - 1 + by, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    setDate(null);
  };

  const days = new Map<string, CalendarDay>((cal.data?.days ?? []).map((d) => [d.date, d]));
  const firstWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();

  return (
    <div className="grid two">
      <section className="card">
        <div className="cal-head">
          <button className="btn ghost" onClick={() => shift(-1)} disabled={month <= today.slice(0, 7)} aria-label="Previous month">‹</button>
          <h2 style={{ margin: 0 }}>{MONTHS[m - 1]} {y}</h2>
          <button className="btn ghost" onClick={() => shift(1)} aria-label="Next month">›</button>
        </div>
        <Alert>{cal.error}</Alert>
        <div className="cal">
          {WEEKDAYS.map((w) => <div key={w} className="dow">{w}</div>)}
          {Array.from({ length: firstWeekday }, (_, i) => <span key={`gap${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const key = `${month}-${String(i + 1).padStart(2, "0")}`;
            const d = days.get(key);
            const full = d && d.availableSlots === 0;
            return (
              <button
                key={key}
                disabled={!d || key < today}
                className={`${date === key ? "sel" : ""} ${full ? "full" : ""}`}
                onClick={() => setDate(key)}
                aria-label={d ? `${key}: ${d.availableSlots} free` : key}
              >
                <span className="n">{i + 1}</span>
                {d && <span className="free">{full ? "full" : `${d.availableSlots} free`}</span>}
              </button>
            );
          })}
        </div>
        {cal.data && !cal.data.days.length && <p className="small muted" style={{ marginTop: 8 }}>No slots this month. Try the next one.</p>}
      </section>

      <section className="card">
        {date ? <DaySlots domain={domain} date={date} onBooked={onBooked} /> : <p className="muted">Pick a date with free slots.</p>}
      </section>
    </div>
  );
}

function DaySlots({ domain, date, onBooked }: { domain: Domain; date: string; onBooked: (link: string | null) => Promise<void> }) {
  const { data, error, reload } = useLoad(() => api.daySlots(domain, date), [domain, date]);
  const [busy, setBusy] = useState<string | null>(null);
  const [bookError, setBookError] = useState<string | null>(null);

  const book = async (s: DaySlot) => {
    if (!window.confirm(`Book ${fmtDateTime(s.startTime)}?`)) return;
    setBookError(null);
    setBusy(s.id);
    try {
      const r = await api.book(s.id);
      await onBooked(r.meetingLink);
    } catch (e) {
      setBookError(errorText(e));
      setBusy(null);
      await reload();
    }
  };

  const label = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long" }).format(new Date(`${date}T12:00:00+05:30`));

  return (
    <>
      <h2>{label}</h2>
      <Alert>{error ?? bookError}</Alert>
      {!data ? (
        <Loading />
      ) : !data.slots.length ? (
        <p className="muted">No slots left on this day.</p>
      ) : (
        data.slots.map((s) => (
          <div key={s.id} className="slot">
            <div>
              <b>{fmtTime(s.startTime)} – {fmtTime(s.endTime)}</b>
              <div className="small muted">{s.remaining > 0 ? `${s.remaining} place${s.remaining === 1 ? "" : "s"} left` : "Full"}</div>
            </div>
            <button className="btn" disabled={s.remaining === 0 || busy !== null} onClick={() => book(s)}>
              {busy === s.id ? "Booking…" : "Book"}
            </button>
          </div>
        ))
      )}
    </>
  );
}
