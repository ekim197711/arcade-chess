import { isLocalHostname } from "./supabaseEnvironment";

export const ANALYTICS_CONSENT_KEY = "arcade-gambit-analytics-consent-v1";
export const ANALYTICS_CONSENT_EVENT = "arcade-gambit-analytics-consent";
type Consent = "granted" | "denied" | null;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  [key: `ga-disable-${string}`]: boolean;
};
const browser = window as unknown as AnalyticsWindow;
const local = isLocalHostname(location.hostname);
const configuredId = (local ? import.meta.env.VITE_GA_DEV_MEASUREMENT_ID : import.meta.env.VITE_GA_MEASUREMENT_ID)?.trim() ?? "";
const measurementId = /^G-[A-Z0-9]{4,30}$/.test(configuredId) ? configuredId : "";
export const analyticsConfigured = !!measurementId;
let consent = readConsent();
let started = false;
let tagInitialized = false;
let previousRoute: string | null = null;

function readConsent(): Consent {
  try {
    const saved = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    return saved === "granted" || saved === "denied" ? saved : null;
  } catch { return null; }
}
export function getAnalyticsConsent() { return consent; }

// Only fixed screen categories leave the browser. Never send a real match ID,
// query string, OAuth callback, account information or a user-supplied route.
export function analyticsPage(hash: string): string | null {
  if (/access_token=|refresh_token=|id_token=|error_description=|code=/i.test(hash)) return null;
  const [screen, second] = hash.replace(/^#\/?/, "").split(/[?&]/)[0].split("/");
  if (!screen) return "home";
  if (screen === "online") return second === "review" ? "online/review" : second === "new" ? "online/search" : second ? "online/match" : "online";
  if (screen === "statistics" || screen === "administration") return "administration";
  return ["home", "roster", "battle", "settings", "review", "result"].includes(screen) ? screen : null;
}
function pageFields(page: string) {
  return { page_location: `${location.origin}/${page}`, page_title: `Arcade Gambit / ${page}`, page_referrer: "" };
}
const denied = { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };

function trackPage() {
  if (!measurementId || consent !== "granted") return;
  const page = analyticsPage(location.hash);
  if (!page || location.hash === previousRoute) return;
  browser[`ga-disable-${measurementId}`] = false;
  if (!tagInitialized) {
    browser.dataLayer = browser.dataLayer ?? [];
    browser.gtag = function () { browser.dataLayer!.push(arguments); };
    browser.gtag("consent", "default", denied);
    browser.gtag("consent", "update", { ...denied, analytics_storage: "granted" });
    browser.gtag("js", new Date());
    browser.gtag("set", pageFields(page));
    browser.gtag("config", measurementId, {
      ...pageFields(page), send_page_view: false,
      allow_google_signals: false, allow_ad_personalization_signals: false,
      cookie_flags: location.protocol === "https:" ? "SameSite=Lax;Secure" : "SameSite=Lax",
    });
    const script = document.createElement("script");
    script.id = "arcade-gambit-google-analytics";
    script.async = true;
    script.referrerPolicy = "no-referrer";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
    tagInitialized = true;
  }
  browser.gtag?.("set", pageFields(page));
  browser.gtag?.("event", "page_view", { ...pageFields(page), send_to: measurementId });
  previousRoute = location.hash;
}
function clearAnalyticsCookies() {
  try {
    const names = document.cookie.split(";").map(cookie => cookie.split("=")[0].trim()).filter(name => name === "_ga" || name.startsWith("_ga_") || name === "_gid" || name.startsWith("_gat"));
    const labels = location.hostname.split(".");
    const domains = ["", ...labels.slice(0, -1).map((_, index) => `; domain=${labels.slice(index).join(".")}`)];
    for (const name of names) for (const domain of domains) document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
  } catch { /* Browser privacy settings may deny access to cookies. */ }
}
function applyConsent() {
  if (!measurementId) return;
  if (consent !== "granted") {
    browser[`ga-disable-${measurementId}`] = true;
    if (tagInitialized) browser.gtag?.("consent", "update", denied);
    clearAnalyticsCookies();
    previousRoute = null;
  } else {
    browser[`ga-disable-${measurementId}`] = false;
    if (tagInitialized) browser.gtag?.("consent", "update", { ...denied, analytics_storage: "granted" });
    trackPage();
  }
}
export function setAnalyticsConsent(granted: boolean) {
  consent = granted ? "granted" : "denied";
  try { localStorage.setItem(ANALYTICS_CONSENT_KEY, consent); } catch { /* Honor the choice for this visit. */ }
  applyConsent();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}
export function startAnalytics() {
  if (started || !measurementId) return;
  started = true;
  applyConsent();
  window.addEventListener("hashchange", trackPage);
  window.addEventListener("storage", event => {
    if (event.key !== ANALYTICS_CONSENT_KEY && event.key !== null) return;
    consent = readConsent();
    applyConsent();
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  });
}
