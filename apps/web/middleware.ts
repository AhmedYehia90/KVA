import createMiddleware from "next-intl/middleware";
import type {NextRequest} from "next/server";
import {routing} from "./i18n/routing";
import {updateSession} from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const intlResponse = intlMiddleware(request);
  const authResponse = await updateSession(request);

  authResponse.cookies.getAll().forEach((cookie) => {
    intlResponse.cookies.set(cookie);
  });

  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"]
};
