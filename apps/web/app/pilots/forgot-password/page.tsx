import Link from "next/link";
import {getLocale} from "next-intl/server";
import {localizeUi} from "@/i18n/localize-ui";
import {requestPasswordReset} from "./actions";

export default async function ForgotPasswordPage({searchParams}: {searchParams: Promise<{error?: string; message?: string}>}) {
  const locale = await getLocale();
  const {error, message} = await searchParams;
  const enabled = process.env.KVA_PASSWORD_RECOVERY_ENABLED === "true";
  return localizeUi(
    <main className="authPage"><section className="authCard">
      <div className="eyebrow">KVA Crew Portal</div><h1>Recover your account</h1>
      {enabled ? <p>Enter your registered email to request a password recovery link.</p> : <p>For account recovery, contact administration using your registered email. Never send your password.</p>}
      {error ? <p className="authError" role="alert">{error === "email" ? "Enter a valid email address." : "Recovery is temporarily unavailable. Please wait and try again."}</p> : null}
      {message === "sent" ? <p role="status">If the email is registered, you will receive a recovery link. Check your inbox and spam folder.</p> : null}
      {enabled ? <form className="authForm" action={requestPasswordReset}>
        <label>Email address<input type="email" name="email" autoComplete="email" required maxLength={254} /></label>
        <button className="button" type="submit">Send recovery link</button>
      </form> : null}
      <p><Link href="/pilots/login">Back to sign in</Link></p>
      <p><a href="mailto:admin@kvafly.com">Contact administration</a></p>
    </section></main>, locale,
  );
}
