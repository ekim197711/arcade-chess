export const SIGNUP_TERMS_VERSION = "2026-10-25.2";

export function SignupDisclaimer() {
  return (
    <section className="signup-disclaimer" aria-labelledby="signup-terms-title">
      <h3 id="signup-terms-title">Terms of use & liability disclaimer</h3>
      <p className="signup-terms-summary">
        Please read before continuing. These terms cover every signup method and
        every free or paid tier. They limit liability where the law allows;
        your mandatory legal rights still apply.
      </p>
      <div className="signup-terms-text" role="region" aria-label="Full terms of use and liability disclaimer" tabIndex={0}>
        <p>Version {SIGNUP_TERMS_VERSION}. In these terms, “Arcade Gambit” means the chess arcade application, its website, games, analysis, artwork, audio, account features, and related services. “We” means the application's operator. References to protected parties include its owners, developers, employees, contributors, and contractors, to the extent each can lawfully benefit from these terms.</p>

        <h4>1. Scope: every access method and plan</h4>
        <p>These terms apply to use of Arcade Gambit through Google, Facebook, GitHub, any other supported signup or login method, and guest access, wherever they have been validly presented and accepted as required by law. They cover free accounts, trials, promotional access, subscriptions, one-time purchases, and any other paid tier that may be offered, including upgrades, downgrades, renewals, and use on different devices. A different login method or price tier does not by itself remove these terms. A paid plan includes only the features and commitments expressly described when purchased, together with all rights required by law. Mentioning a plan here does not mean it is currently offered.</p>

        <h4>2. Entertainment and learning</h4>
        <p>Arcade Gambit is for entertainment and informal chess practice. Boss ratings, rankings, analysis, move suggestions, scores, achievements, and progress indicators may be approximate or incorrect. They are not official ratings, professional coaching, or a promise of tournament results, improvement, earnings, prizes, or any other outcome. Virtual credits and achievements have no cash redemption value unless an offer expressly states otherwise. You are responsible for deciding how to use game information.</p>

        <h4>3. Availability and technical risks</h4>
        <p>To the extent permitted by applicable law, the service is provided “as is” and “as available”, without additional implied warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not promise uninterrupted access, error-free operation, perfect security, compatibility with every device, or permanent storage. Bugs, updates, maintenance, network failures, browser settings, and third-party outages can interrupt play or affect results. These statements do not reduce any binding product description, express commitment, duty of care, or statutory guarantee, including rights relating to the conformity of digital services.</p>

        <h4>4. Accounts, saves, and third-party services</h4>
        <p>Keep your login credentials secure and use only accounts you are entitled to access. Guest saves depend on local browser storage and can disappear when you clear data, change browser or device, or use private browsing. Cloud saves and sync can be delayed or fail; keep an independent copy of anything important where an export is available. Authentication, hosting, and payment services may have their own terms and privacy information. We do not control those services, but remain responsible for obligations the law places on us. This disclaimer is not consent to personal-data processing and does not replace applicable privacy information or data-protection rights.</p>

        <h4>5. Play responsibly</h4>
        <p>Take breaks, choose a comfortable sound level, and stop if animations, flashing effects, sound, or extended play cause discomfort. Use available sound and motion settings to suit your needs. Cartoon taunts and fictional opponents are part of the entertainment. Do not misuse the service, interfere with other systems, infringe others' rights, or bypass access restrictions. You remain responsible for your own unlawful conduct; this does not transfer responsibility for our conduct to you.</p>

        <h4>5a. Multiplayer code of conduct</h4>
        <p>If you take part in multiplayer games, chat, or other player interactions when those features are available, speak to other players respectfully. Keep conversation friendly, give constructive feedback, and respect a player's request to stop a conversation. Friendly rivalry is welcome; personal insults, harassment, bullying, threats, hateful or discriminatory language, sexual harassment, spam, and sharing another person's private information are not. Do not cheat, impersonate others, or encourage abuse. The fictional bosses' cartoon taunts are not a model for how to treat real players.</p>
        <p>Bad behaviour or other breaches of this code of conduct may lead to a warning, restrictions on communication or play, a temporary account freeze, or cancellation of your account. Serious or repeated misconduct may lead directly to an account freeze or cancellation. Any action must be proportionate and comply with applicable law, including any required explanation, review, and consumer or data-protection rights. Multiplayer is not currently available; these rules apply if player interaction features are introduced.</p>

        <h4>6. Free access, purchases, and changes</h4>
        <p>The signup choices “Free” and “Very free” both cost 0 kr. and currently include the same features. Choosing either tier does not authorize a payment or enroll you in a paid subscription.</p>
        <p>Paying for a plan does not create guarantees beyond the advertised offer, an express agreement, and applicable law. Price, billing period, renewal, cancellation, and included features must be disclosed with the relevant purchase. These terms do not authorize undisclosed charges, automatically enroll you in a paid plan, or waive statutory withdrawal, cancellation, refund, repair, price-reduction, or termination rights. Any changes to features, paid services, or these terms must respect existing commitments and applicable notice, consent, and termination requirements. A later version does not retrospectively remove rights or claims you already have.</p>

        <h4>7. Limits on liability where permitted</h4>
        <p>Only to the extent permitted by applicable law, the protected parties are not liable for indirect, incidental, special, consequential, exemplary, or punitive losses arising from use of, or inability to use, the service, including lost profits, business opportunities, anticipated savings, goodwill, or data. This applies, where lawful, whether a claim is framed in contract, tort (including ordinary negligence), or another legal theory, and whether the possibility of loss was communicated. It does not exclude losses or remedies that the law requires us to cover.</p>
        <p>For claims that may lawfully be capped, the combined aggregate liability of the protected parties arising from the service is limited to the greater of EUR 100 and the amount you paid us for the service during the 12 months before the event giving rise to the claim. This is one combined cap, not a separate cap for each protected party or claim. It covers free and paid access only where enforceable and does not limit mandatory refunds or other remedies that cannot lawfully be capped. If a limit is not permitted, the applicable legal rules govern that liability.</p>

        <h4>8. Rights and liabilities that remain protected</h4>
        <p>Nothing in these terms excludes or limits liability for fraud, fraudulent misrepresentation, deliberate misconduct, gross negligence, death or personal injury caused by negligence, or any other liability that cannot lawfully be excluded or limited. Nothing waives mandatory consumer rights, digital-service guarantees, data-protection rights, or your right to contact a regulator, seek legal advice, bring proceedings, or use an available dispute-resolution process. Mandatory protections in your country of residence continue to apply. No disclaimer can guarantee immunity from claims or lawsuits.</p>

        <h4>9. Interpretation and acceptance</h4>
        <p>Each limitation applies only as far as the law permits. If a provision is invalid or unfair, it is not binding to that extent; the remaining provisions continue only where legally possible. No provision requires you to pay our legal costs merely for making a complaint or pursuing a lawful claim. By checking the acceptance box and continuing with a signup or login provider, you agree to this version of the terms. That agreement is separate from any purchase authorization and does not establish acceptance of future changes without any further steps required by law.</p>
      </div>
    </section>
  );
}
