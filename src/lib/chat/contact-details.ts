/**
 * Spots phone numbers, emails, messaging apps, UPI IDs and "pay outside"
 * phrases in chat messages, so the app can remind people to keep deals and
 * payments on Workido. Mirrors public.mentions_contact_details() in the
 * database, which flags stored messages authoritatively.
 */
const PATTERNS: RegExp[] = [
  /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
  /(\+?\d[\s().-]*){10,}/,
  /\b(whats\s*app|watsapp|telegram|skype|wa\.me|t\.me|signal app)\b/i,
  /\b(g\s*pay|google pay|phone\s*pe|paytm|upi|bank transfer|neft|imps)\b/i,
  /\b[a-z0-9._-]+@(ok)?(axis|hdfcbank|icici|sbi|ybl|paytm|upi|apl|ibl)\b/i,
  /\bpay (me )?(directly|outside|offline)\b/i,
  /\boutside (of )?(the )?(platform|workido|site|app)\b/i,
];

export function mentionsContactDetails(text: string | null | undefined): boolean {
  if (!text) return false;
  return PATTERNS.some((pattern) => pattern.test(text));
}
