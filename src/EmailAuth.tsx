import { useState, type FormEvent } from "react";
import { supabase, supabaseConfiguration } from "./supabase";
import type { SignupPlan } from "./SignupPlans";
import "./emailAuth.css";

export function EmailAuth({ termsAccepted, plan, recovery = false, onComplete }: {
  termsAccepted: boolean;
  plan: SignupPlan;
  recovery?: boolean;
  onComplete: () => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function changeMode(next: typeof mode) {
    setMode(next);
    setPassword("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!recovery && mode !== "reset" && !termsAccepted) {
      setMessage("Please read and accept the terms of use before continuing.");
      return;
    }
    if (!supabase) { setMessage(supabaseConfiguration.error); return; }
    setBusy(true);
    setMessage("");
    try {
      if (recovery) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        onComplete();
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setMessage("If an account exists for this email, you will receive a password reset link.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin, data: { arcade_plan: plan } },
        });
        if (error) throw error;
        setPassword("");
        if (data.session) onComplete();
        else setMessage("Check your email for a confirmation link, then return here to sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        setPassword("");
        onComplete();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to connect. Please try again.");
    } finally { setBusy(false); }
  }

  return <form className="email-auth" onSubmit={(event) => void submit(event)}>
    <h3>{recovery ? "Choose a new password" : mode === "signup" ? "Create an account with email" : mode === "reset" ? "Reset your password" : "Sign in with email"}</h3>
    <fieldset disabled={busy}>
      {!recovery && <label htmlFor="auth-email">Email
        <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>}
      {(recovery || mode !== "reset") && <label htmlFor="auth-password">{recovery ? "New password" : "Password"}
        <input id="auth-password" type="password" autoComplete={recovery || mode === "signup" ? "new-password" : "current-password"} minLength={recovery || mode === "signup" ? 6 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required />
      </label>}
      <button className="social-button" type="submit" disabled={!recovery && mode !== "reset" && !termsAccepted}>
        {busy ? "PLEASE WAIT…" : recovery ? "SAVE NEW PASSWORD" : mode === "signup" ? "CREATE ACCOUNT" : mode === "reset" ? "SEND RESET LINK" : "SIGN IN WITH EMAIL"}
      </button>
      {!recovery && <div className="email-auth-links">
        <button type="button" onClick={() => changeMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Create an account" : "Back to sign in"}</button>
        {mode !== "reset" && <button type="button" onClick={() => changeMode("reset")}>Forgot password?</button>}
      </div>}
    </fieldset>
    {message && <p className="auth-message" role="status">{message}</p>}
  </form>;
}
