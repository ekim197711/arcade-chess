import { useCallback, useEffect, useRef, useState } from "react";
import { APP_BUILD, parseDeployment, type DeploymentInfo } from "./buildInfo";
import { isLocalHostname } from "./supabaseEnvironment";

function Timestamp({ value }: { value: string }) {
  return <time dateTime={value}>{new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "long", timeZone: "Europe/Copenhagen" }).format(new Date(value))}</time>;
}

export function BuildVersion() {
  const [deployment, setDeployment] = useState<DeploymentInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const active = useRef(false);
  const request = useRef<AbortController | null>(null);
  const preview = import.meta.env.DEV || isLocalHostname(location.hostname);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setError("");
    try {
      const response = await fetch("/deployment.json", { cache: "no-store", credentials: "omit", signal: controller.signal });
      if (!response.ok) throw new Error("Deployment record unavailable");
      const info = parseDeployment(await response.json());
      if (active.current && !controller.signal.aborted) setDeployment(info);
    } catch {
      if (active.current && !controller.signal.aborted) { setDeployment(null); setError("Deployment details are unavailable. The loaded build is shown below."); }
    } finally { if (active.current && !controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    active.current = true;
    if (!preview) void refresh();
    return () => { active.current = false; request.current?.abort(); };
  }, [preview, refresh]);

  return <section className="admin-release" aria-labelledby="admin-release-title">
    <h2 id="admin-release-title">Version & deployment</h2>
    {preview && <p className="admin-note">Development preview</p>}
    {error && <p role="status">{error}</p>}
    <dl className="admin-release-details">
      <div><dt>Loaded version</dt><dd>v{APP_BUILD.version}</dd></div>
      <div><dt>Git commit</dt><dd><code>{APP_BUILD.commit?.slice(0, 12) ?? "Unavailable"}</code></dd></div>
      <div><dt>Built</dt><dd><Timestamp value={APP_BUILD.builtAt} /></dd></div>
      {deployment && <>
        <div><dt>Live version</dt><dd>v{deployment.version}</dd></div>
        <div><dt>Deployed</dt><dd><Timestamp value={deployment.deployedAt} /></dd></div>
        <div><dt>Live commit</dt><dd><code>{deployment.commit?.slice(0, 12) ?? "Unavailable"}</code>{deployment.dirty && " + uncommitted changes"}</dd></div>
      </>}
    </dl>
    {APP_BUILD.dirty && <p className="admin-note">This build includes uncommitted changes.</p>}
    <p className="admin-note">Build ID: <code>{APP_BUILD.buildId}</code>. Times shown in Europe/Copenhagen.</p>
    {deployment && deployment.buildId !== APP_BUILD.buildId && <p className="admin-release-update" role="status">A different release is deployed. <button onClick={() => window.location.reload()}>Reload app</button></p>}
    {!preview && <button disabled={loading} onClick={() => void refresh()}>{loading ? "Checking deployment…" : "Refresh deployment info"}</button>}
  </section>;
}
