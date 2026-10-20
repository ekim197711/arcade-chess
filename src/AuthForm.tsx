import { useEffect, useRef, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, Github, LockKeyhole } from "lucide-react";
import "./auth.css";

type Mode = "signup" | "signin" | "forgot" | "recovery";
type Props = {
  client: SupabaseClient | null;
  recovering: boolean;
  onRecoveryComplete: () => void;
  onGuest: () => void;
  redirectError?: boolean;
};

export function AuthForm({
  client,
  recovering,
  onRecoveryComplete,
  onGuest,
  redirectError,
}: Props) {
  const [mode, setMode] = useState<Mode>(recovering ? "recovery" : "signup");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(
    redirectError
      ? "Sign-in wasn’t completed. Please try again or choose another sign-in method."
      : "",
  );
  const pending = useRef(false);
  const isNewPassword = mode === "signup" || mode === "recovery";
  const redirectUrl = () =>
    `${window.location.origin}${window.location.pathname}`;

  useEffect(() => {
    if (recovering) setMode("recovery");
  }, [recovering]);

  function changeMode(next: Mode) {
    setMode(next);
    setMessage("");
    setError("");
    setPassword("");
    setConfirmation("");
    setShowPassword(false);
  }

  async function run(action: () => Promise<void>) {
    if (!client || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    if (isNewPassword && password !== confirmation) {
      setError("Your passwords don’t match.");
      return;
    }
    await run(async () => {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: redirectUrl(),
            ...(name.trim() ? { data: { full_name: name.trim() } } : {}),
          },
        });
        if (error) throw error;
        setPassword("");
        setConfirmation("");
        if (!data.session)
          setMessage(
            "Check your inbox for a confirmation link. If you already have an account, sign in instead.",
          );
      } else if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setPassword("");
      } else if (mode === "forgot") {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirectUrl() },
        );
        if (error) throw error;
        setMessage(
          "If an account exists for this email, you’ll receive a password reset link shortly.",
        );
      } else {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmation("");
        onRecoveryComplete();
      }
    });
  }

  async function social(provider: "google" | "github" | "facebook") {
    await run(async () => {
      const { error } = await client!.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectUrl() },
      });
      if (error) throw error;
    });
  }

  return (
    <div className="auth-flow">
      <div className="modal-eyebrow">
        <span /> YOUR ARCADE ID
      </div>
      <h2 id="auth-title">
        {mode === "signup"
          ? "JOIN THE ARCADE"
          : mode === "signin"
            ? "WELCOME BACK"
            : mode === "forgot"
              ? "RESET PASSWORD"
              : "NEW PASSWORD"}
      </h2>
      <p className="modal-description">
        {mode === "signup"
          ? "Create an account to keep your progress wherever you play."
          : mode === "signin"
            ? "Sign in and pick up your run."
            : mode === "forgot"
              ? "We’ll email you a link to choose a new password."
              : "Choose a new password to get back to your game."}
      </p>
      {(mode === "signup" || mode === "signin") && (
        <>
          <div
            className="auth-mode-switch"
            role="group"
            aria-label="Account options"
          >
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === "signup"}
              onClick={() => changeMode("signup")}
            >
              Create account
            </button>
            <button
              type="button"
              disabled={busy}
              aria-pressed={mode === "signin"}
              onClick={() => changeMode("signin")}
            >
              Sign in
            </button>
          </div>
          <div className="social-login-list">
            {(["google", "github", "facebook"] as const).map((provider) => (
              <button
                key={provider}
                type="button"
                className="social-button"
                disabled={!client || busy}
                onClick={() => void social(provider)}
              >
                {provider === "github" ? (
                  <Github size={16} aria-hidden="true" />
                ) : (
                  <span
                    aria-hidden="true"
                    className={
                      provider === "google" ? "google-g" : "facebook-f"
                    }
                  >
                    {provider === "google" ? "G" : "f"}
                  </span>
                )}
                Continue with{" "}
                {provider === "github"
                  ? "GitHub"
                  : provider === "google"
                    ? "Google"
                    : "Facebook"}
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
          <div className="auth-divider">or use your email</div>
        </>
      )}
      {!client && (
        <p className="auth-feedback" role="status">
          Account sign-in is temporarily unavailable. You can still play as a
          guest.
        </p>
      )}
      <form className="auth-email-form" onSubmit={submit} aria-busy={busy}>
        <fieldset disabled={!client || busy}>
          {mode === "signup" && (
            <label htmlFor="auth-name">
              Player name <span>(optional)</span>
              <input
                id="auth-name"
                autoComplete="nickname"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}
          {mode !== "recovery" && (
            <label htmlFor="auth-email">
              Email
              <input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "forgot" && (
            <>
              <label htmlFor="auth-password">
                {mode === "recovery" ? "New password" : "Password"}
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    isNewPassword ? "new-password" : "current-password"
                  }
                  minLength={isNewPassword ? 8 : undefined}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby={
                    isNewPassword ? "auth-password-hint" : undefined
                  }
                />
              </label>
              {isNewPassword && (
                <small id="auth-password-hint">
                  Use at least 8 characters.
                </small>
              )}
              {isNewPassword && (
                <label htmlFor="auth-confirm">
                  Confirm password
                  <input
                    id="auth-confirm"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                  />
                </label>
              )}
              <label className="auth-show-password">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                Show password
              </label>
            </>
          )}
          <button className="auth-submit" type="submit">
            {busy
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Save new password"}
            <ArrowRight size={15} />
          </button>
        </fieldset>
      </form>
      {error && (
        <p className="auth-feedback auth-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-feedback" role="status">
          {message}
        </p>
      )}
      {mode === "signin" && (
        <button
          className="auth-text-button"
          type="button"
          disabled={busy}
          onClick={() => changeMode("forgot")}
        >
          Forgot password?
        </button>
      )}
      {mode === "forgot" && (
        <button
          className="auth-text-button"
          type="button"
          disabled={busy}
          onClick={() => changeMode("signin")}
        >
          Back to sign in
        </button>
      )}
      <button className="guest-link" type="button" onClick={onGuest}>
        {recovering ? "Back to game" : "Keep playing as guest"}
      </button>
      <p className="privacy-note">
        <LockKeyhole size={11} /> Your guest progress stays on this device.
      </p>
    </div>
  );
}
