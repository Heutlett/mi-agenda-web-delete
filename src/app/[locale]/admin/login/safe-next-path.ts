/**
 * Validates a `?next=` redirect target from the login URL. Only an
 * internal, `/admin`-prefixed path is safe: `next` is attacker-controllable
 * (anyone can link to `/admin/login?next=...`), so anything else — an
 * absolute URL, a protocol-relative `//evil.example` URL, or a path outside
 * `/admin` — is rejected in favor of the default, to avoid turning a
 * successful login into an open redirect.
 */
export function safeNextPath(next: string | null): string {
  if (next && next.startsWith("/admin") && !next.startsWith("//")) {
    return next;
  }
  return "/admin";
}
