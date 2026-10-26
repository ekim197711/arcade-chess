import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Cookie } from "lucide-react";
import "./cookieNotice.css";

const NOTICE_KEY = "arcade-gambit-storage-notice-v1";

function hasSeenNotice() {
  try { return localStorage.getItem(NOTICE_KEY) === "acknowledged"; }
  catch { return false; }
}

export function CookieNotice({ resetRequest = 0 }: { resetRequest?: number }) {
  const [open, setOpen] = useState(() => !hasSeenNotice());
  const [details, setDetails] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (resetRequest === 0) return;
    try { localStorage.removeItem(NOTICE_KEY); }
    catch { /* Still allow previewing the notice when storage is unavailable. */ }
    setDetails(false);
    setOpen(true);
    const frame = requestAnimationFrame(() => panel.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [resetRequest]);

  function dismiss() {
    try { localStorage.setItem(NOTICE_KEY, "acknowledged"); }
    catch { /* The notice can still be dismissed for this visit. */ }
    const restoreFocus = panel.current?.contains(document.activeElement);
    setOpen(false);
    setDetails(false);
    if (restoreFocus) launcher.current?.focus({ preventScroll: true });
  }

  return <>
    <button ref={launcher} className="cookie-notice-launcher" type="button"
      aria-controls="cookie-notice" aria-expanded={open}
      onClick={() => { setOpen(true); setDetails(true); requestAnimationFrame(() => panel.current?.focus()); }}>
      <Cookie size={13} aria-hidden="true" /> Cookies & storage
    </button>
    {open && createPortal(
      <aside ref={panel} id="cookie-notice" className="cookie-notice" tabIndex={-1}
        aria-labelledby="cookie-notice-title" onKeyDown={event => { if (event.key === "Escape") dismiss(); }}>
        <div className="cookie-notice-art" aria-hidden="true">
          <Cookie size={36} strokeWidth={1.6} />
          <span>+1 BYTE</span>
        </div>
        <div className="cookie-notice-content">
          <span className="cookie-notice-eyebrow"><i aria-hidden="true" /> THE MANDATORY SIDE QUEST</span>
          <h2 id="cookie-notice-title">Even arcades have cookies.</h2>
          <p>We use browser storage to remember your progress, settings and sign-in.
            Chess, and a few crumbs.</p>
          {details && <div id="cookie-notice-details" className="cookie-notice-details">
            <p><strong>What stays on your device?</strong> Guest saves, game history, preferences,
              sign-in sessions when you log in, and your acknowledgement of this notice.
              Guest saves use local storage, rather than cookies.</p>
            <p>Signing in enables cloud progress through Supabase. Your login provider may use
              cookies on its own site. Clearing this site's browser data removes local saves,
              settings and this acknowledgement. You can revisit this notice from the footer.</p>
          </div>}
          <div className="cookie-notice-bottom">
            <div className="cookie-notice-actions">
              <button type="button" className="cookie-notice-more" aria-expanded={details}
                aria-controls="cookie-notice-details" onClick={() => setDetails(value => !value)}>
                {details ? "Less detail" : "The details"}
              </button>
              <button type="button" className="cookie-notice-accept" onClick={dismiss}>
                Let’s play <ArrowRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>, document.body)}
  </>;
}
