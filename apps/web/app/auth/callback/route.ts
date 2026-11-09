import {NextResponse} from "next/server";
import {createClient} from "@/lib/supabase/server";
import {safeAuthPath} from "@/lib/auth/security";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const failure = () => NextResponse.redirect(new URL("/pilots/login?error=callback", url.origin));
  if (!code || url.searchParams.has("error")) return failure();
  try {
    const supabase = await createClient();
    const {error} = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure();
  } catch {
    return failure();
  }
  return NextResponse.redirect(new URL(safeAuthPath(url.searchParams.get("next")), url.origin));
}
