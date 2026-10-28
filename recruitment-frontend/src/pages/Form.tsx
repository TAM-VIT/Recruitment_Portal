import { useEffect, useState } from "react";
import type { Session } from "../App";
import { api, errorText, fmtTime, type Domain, type FormApplication, type Question } from "../api";
import { Alert, Loading, useLoad } from "../components";

export default function Form({ session }: { session: Session }) {
  const { data, error, reload } = useLoad(() => api.form());
  const [domain, setDomain] = useState<Domain | null>(null);

  useEffect(() => {
    if (data && !domain && data.applications[0]) setDomain(data.applications[0].domain);
  }, [data, domain]);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Loading />;
  if (!data.applications.length) return <Alert kind="info">You haven't applied to any domain. Add one on the Profile page.</Alert>;

  const app = data.applications.find((a) => a.domain === domain) ?? data.applications[0];

  return (
    <>
      <h1>Application form</h1>
      <div className="chips" role="tablist">
        {data.applications.map((a) => (
          <button key={a.domain} role="tab" aria-selected={a.domain === app.domain} className={`chip ${a.domain === app.domain ? "active" : ""}`} onClick={() => setDomain(a.domain)}>
            {a.label} {a.submitted ? "✓" : ""}
          </button>
        ))}
      </div>
      <DomainForm key={app.domain} app={app} onSubmitted={async () => { await reload(); await session.refresh(); }} />
    </>
  );
}

function DomainForm({ app, onSubmitted }: { app: FormApplication; onSubmitted: () => Promise<void> }) {
  const [answered, setAnswered] = useState(() => new Set(app.questions.filter((q) => q.answer.trim()).map((q) => q.id)));
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const requiredDone = app.questions.filter((q) => q.required && answered.has(q.id)).length;
  const requiredTotal = app.progress.requiredTotal;

  // questions grouped by subsection; ones without a subsection go under "General"
  const groups = [
    ...app.subsections.map((s) => ({ id: s.id, name: s.name, questions: app.questions.filter((q) => q.subsectionId === s.id) })),
    { id: "general", name: "General", questions: app.questions.filter((q) => !q.subsectionId) },
  ].filter((g) => g.questions.length);

  const submit = async () => {
    if (!window.confirm(`Submit your ${app.label} application? You won't be able to change these answers.`)) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      await api.submit(app.domain);
      await onSubmitted();
    } catch (e) {
      setSubmitError(errorText(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {app.submitted ? (
        <Alert kind="ok">You've submitted this domain. Answers are read-only.</Alert>
      ) : app.deadlinePassed ? (
        <Alert kind="warn">The deadline has passed. Answers are read-only.</Alert>
      ) : !app.editable ? (
        <Alert kind="warn">Applications are closed. Answers are read-only.</Alert>
      ) : null}

      <section className="card">
        <div className="card-head">
          <h2>{app.label}</h2>
          <span className="small muted">{requiredDone} of {requiredTotal} required answered</span>
        </div>
        <div className="progress" aria-hidden="true">
          <div style={{ width: `${requiredTotal ? (requiredDone / requiredTotal) * 100 : 100}%` }} />
        </div>
      </section>

      {groups.map((g) => (
        <section key={g.id} className="card">
          <h3>{g.name}</h3>
          {g.questions.map((q) => (
            <QuestionBox
              key={q.id}
              q={q}
              editable={app.editable}
              onSaved={(text) =>
                setAnswered((prev) => {
                  const next = new Set(prev);
                  if (text.trim()) next.add(q.id);
                  else next.delete(q.id);
                  return next;
                })
              }
            />
          ))}
        </section>
      ))}

      {app.editable && (
        <section className="card">
          <Alert>{submitError}</Alert>
          <p className="small muted">Save every answer first. Submitting locks this domain's answers.</p>
          <button className="btn block" onClick={submit} disabled={submitting}>
            {submitting ? "Submitting…" : `Submit ${app.label}`}
          </button>
        </section>
      )}
    </>
  );
}

function QuestionBox({ q, editable, onSaved }: { q: Question; editable: boolean; onSaved: (text: string) => void }) {
  const [text, setText] = useState(q.answer);
  const [saved, setSaved] = useState(q.answer);
  const [savedAt, setSavedAt] = useState(q.savedAt);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = text !== saved;

  const save = async () => {
    setError(null);
    setBusy(true);
    try {
      const r = await api.saveAnswer(q.id, text);
      setSaved(text);
      setSavedAt(r.savedAt);
      onSaved(text);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="question">
      <label className="field" style={{ marginBottom: 0 }}>
        <span>
          {q.text} {q.required && <span className="muted">*</span>}
        </span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} readOnly={!editable} maxLength={q.maxLength} />
      </label>
      <div className="question-foot">
        <span className="small muted">
          {text.length}/{q.maxLength}
          {dirty ? " · not saved" : savedAt ? ` · saved ${fmtTime(savedAt)}` : ""}
        </span>
        {editable && (
          <button className="btn secondary" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </button>
        )}
      </div>
      {error && <Alert>{error}</Alert>}
    </div>
  );
}
