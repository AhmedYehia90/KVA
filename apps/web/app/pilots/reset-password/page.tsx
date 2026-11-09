import Link from "next/link";
import {redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import {createClient} from "@/lib/supabase/server";
import {localizeUi} from "@/i18n/localize-ui";
import {resetPassword} from "./actions";

export default async function ResetPasswordPage({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const locale = await getLocale();
  const supabase = await createClient();
  const {data: {user}} = await supabase.auth.getUser();
  if (!user) redirect("/pilots/login?error=callback");
  const {error} = await searchParams;
  return localizeUi(
    <main className="authPage"><section className="authCard">
      <div className="eyebrow">KVA Crew Portal</div><h1>Set a new password</h1>
      <p>Use at least 12 characters. Both password fields must match.</p>
      {error ? <p className="authError" role="alert">{error === "password" ? "Use at least 12 characters and enter the same password twice." : "Unable to update the password. Please request a new recovery link."}</p> : null}
      <form className="authForm" action={resetPassword}>
        <label>New password<input type="password" name="password" autoComplete="new-password" required minLength={12} maxLength={1024} /></label>
        <label>Confirm password<input type="password" name="confirmation" autoComplete="new-password" required minLength={12} maxLength={1024} /></label>
        <button className="button" type="submit">Update password</button>
      </form>
      <p><Link href="/pilots/login">Back to sign in</Link></p>
    </section></main>, locale,
  );
}
