import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Renamed from Next.js's former `middleware.ts` convention; see
// https://nextjs.org/docs/app/api-reference/file-conventions/proxy.
export default createMiddleware(routing);

export const config = {
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
