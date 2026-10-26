export type SignupPlan = "free" | "very-free";
export const PENDING_SIGNUP_PLAN_KEY = "arcade-chess-pending-signup-plan-v1";

export function readSignupPlan(): SignupPlan {
  try { return localStorage.getItem(PENDING_SIGNUP_PLAN_KEY) === "very-free" ? "very-free" : "free"; }
  catch { return "free"; }
}

export function SignupPlans({ value, onChange }: { value: SignupPlan; onChange: (plan: SignupPlan) => void }) {
  return <fieldset className="signup-plans" aria-describedby="signup-plan-description">
    <legend>Choose your price tier</legend>
    <p id="signup-plan-description">Both plans are free and include the same features. No payment details needed.</p>
    <div className="signup-plan-options">
      {([{ id: "free", name: "Free" }, { id: "very-free", name: "Very free" }] as const).map((plan) =>
        <label key={plan.id} className={`signup-plan${value === plan.id ? " signup-plan-selected" : ""}`}>
          <input type="radio" name="signup-plan" value={plan.id} checked={value === plan.id} onChange={() => onChange(plan.id)} />
          <span><strong>{plan.name}</strong><small>0 kr.</small></span>
        </label>)}
    </div>
  </fieldset>;
}
