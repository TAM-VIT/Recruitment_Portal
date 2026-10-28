import { useState } from "react";
import type { Session } from "../App";
import { ALL_STAGES, api, errorText, fmtDateTime, STAGE_LABELS, type Stage, type StatusApplication, type StatusResponse } from "../api";
import { Alert, Loading, useLoad } from "../components";

export default function Status({ session }: { session: Session }) {
  const { data, error, reload } = useLoad(() => api.status());

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;

  return (
    <>
      <h1>Your applications</h1>
      <p className="muted">Each domain moves through the stages on its own.</p>
      <div className="grid two">
        {data.applications.map((app) => (
          <StatusCard key={app.domain} app={app} stages={data.stages} session={session} />
        ))}
      </div>
      {data.applications.length === 0 && <Alert kind="info">You haven't applied to any domain. Add one on the Profile page.</Alert>}
      {session.info?.testTools && <TestTools apps={data.applications} onChanged={reload} />}
    </>
  );
}

function StatusCard({ app, stages, session }: { app: StatusApplication; stages: StatusResponse["stages"]; session: Session }) {
  const badge = app.rejected
    ? <span className="badge bad">Rejected</span>
    : app.stage === "SELECTED"
      ? <span className="badge good">Selected</span>
      : <span className="badge">{STAGE_LABELS[app.stage]}</span>;

  return (
    <section className="card">
      <div className="card-head">
        <h2>{app.label}</h2>
        {badge}
      </div>

      {app.rejected ? (
        <p className="muted">This application was not taken forward.</p>
      ) : (
        <ol className="steps">
          {stages.map((s, i) => {
            const cls = app.currentIndex === null ? "" : i < app.currentIndex ? "done" : i === app.currentIndex ? "now" : "";
            return (
              <li key={s.key} className={cls}>
                <span className="dot">{cls === "done" ? "✓" : i + 1}</span>
                {s.label}
              </li>
            );
          })}
        </ol>
      )}

      <p className="small">
        Form:{" "}
        {app.submitted ? <span className="badge good">Submitted</span> : app.editable ? <span className="badge warn">Not submitted</span> : <span className="badge bad">Locked</span>}
      </p>

      {app.booking ? (
        <div className="alert ok">
          Interview: <b>{fmtDateTime(app.booking.slot.startTime)}</b>
          {app.booking.slot.meetingLink && (
            <>
              <br />
              <a href={app.booking.slot.meetingLink} target="_blank" rel="noreferrer">Meeting link</a>
            </>
          )}
        </div>
      ) : app.canChooseSlots ? (
        <button className="btn block" onClick={() => session.go("slots")}>Choose an interview slot</button>
      ) : !app.submitted && app.editable ? (
        <button className="btn secondary block" onClick={() => session.go("form")}>Fill the form</button>
      ) : null}
    </section>
  );
}

// Test-only: stands in for the admin backend (needs ENABLE_TEST_TOOLS=true on the backend)
function TestTools({ apps, onChanged }: { apps: StatusApplication[]; onChanged: () => Promise<void> }) {
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const set = async (app: StatusApplication, stage: Stage) => {
    setMsg(null);
    try {
      await api.setStage(app.domain, stage);
      setMsg({ kind: "ok", text: `${app.label} is now "${STAGE_LABELS[stage]}".` });
      await onChanged();
    } catch (e) {
      setMsg({ kind: "error", text: errorText(e) });
    }
  };

  return (
    <section className="card test-tools">
      <h2>Test tools</h2>
      <p className="muted small">
        For testing only. Admins normally set these stages in the admin backend. Set a domain to "Shortlisted" to try booking a slot.
      </p>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {apps.map((app) => (
        <label key={app.domain} className="field">
          <span>{app.label}</span>
          <select value={app.stage} onChange={(e) => set(app, e.target.value as Stage)}>
            {ALL_STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABELS[s]}</option>
            ))}
          </select>
        </label>
      ))}
    </section>
  );
}
