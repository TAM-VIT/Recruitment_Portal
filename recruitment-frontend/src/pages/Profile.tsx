import { useEffect, useState } from "react";
import type { Session } from "../App";
import { api, errorText, type Domain, type DomainInfo } from "../api";
import { Alert, DomainChecks } from "../components";

export default function Profile({ session }: { session: Session }) {
  const { user, applications } = session;
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [regNumber, setRegNumber] = useState(user.regNumber);
  const [domains, setDomains] = useState<Domain[]>(applications.map((a) => a.domain));
  const [domainList, setDomainList] = useState<DomainInfo[]>([]);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.domains().then((r) => setDomainList(r.domains)).catch((e) => setMsg({ kind: "error", text: errorText(e) }));
  }, []);

  // a domain that was submitted or moved past form filling can't be removed
  const locked = applications.filter((a) => a.submitted || a.stage !== "FORM_FILLING").map((a) => a.domain);
  const domainsChanged = [...domains].sort().join() !== applications.map((a) => a.domain).sort().join();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    try {
      const body: Parameters<typeof api.updateMe>[0] = {};
      if (name !== user.name) body.name = name;
      if (phone !== user.phone) body.phone = phone;
      if (regNumber !== user.regNumber) body.regNumber = regNumber;
      if (domainsChanged) body.domains = domains;
      if (!Object.keys(body).length) {
        setMsg({ kind: "ok", text: "Nothing to change." });
        return;
      }
      await api.updateMe(body);
      await session.refresh();
      setMsg({ kind: "ok", text: "Saved." });
    } catch (err) {
      setMsg({ kind: "error", text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1>Profile</h1>
      <form className="card" onSubmit={save} noValidate>
        {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
        <label className="field">
          <span>Email</span>
          <input type="email" value={user.email} readOnly />
          <small>Your email can't be changed.</small>
        </label>
        <div className="grid two">
          <label className="field">
            <span>Full name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span>Phone</span>
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
        <label className="field">
          <span>Registration number</span>
          <input type="text" autoCapitalize="characters" value={regNumber} onChange={(e) => setRegNumber(e.target.value)} />
        </label>
        <div className="field">
          <span>Domains</span>
          <DomainChecks domains={domainList} value={domains} onChange={setDomains} locked={locked} />
          <small>Removing a domain deletes its saved answers. Domains can't change after the deadline.</small>
        </div>
        <button className="btn block" disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
      </form>
    </>
  );
}
