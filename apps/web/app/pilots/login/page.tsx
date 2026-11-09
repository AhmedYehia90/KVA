import {localizeUi} from "@/i18n/localize-ui";
import {getLocale as getUiLocale} from "next-intl/server";
import {login} from "./actions";
import Link from "next/link";

type Props = {
  searchParams: Promise<{error?: string; message?: string}>;
};

export default async function PilotLoginPage({searchParams}: Props) {
  const uiLocale = await getUiLocale();

  const {error, message} = await searchParams;
  const errorMessages: Record<string, string> = {
    missing: "Enter your email and password.",
    invalid: "The email or password is incorrect.",
    unavailable: "Sign-in is temporarily unavailable. Please try again later.",
    limited: "Too many sign-in attempts. Please wait and try again.",
    callback: "The sign-in link is invalid or expired. Please sign in again or request a new recovery link.",
  };

  return localizeUi((
    <main className="authPage">
      <section className="authCard">
        <div className="eyebrow">KVA Crew Portal</div>
        <h1>Pilot Login</h1>
        <p className="muted">
          Sign in with your registered Kalabsha Airlines pilot account.
        </p>

        {error ? (
          <div className="authError" role="alert">
            {errorMessages[error] ?? errorMessages.invalid}
          </div>
        ) : null}

        {message === "password-updated" ? <p role="status">Password updated. Sign in with your new password.</p> : null}

        <form action={login} className="authForm">
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="pilot@example.com"
            />
          </label>

          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>

          <button className="button" type="submit">
            Sign In
          </button>
        </form>
        <p><Link href="/pilots/forgot-password">Forgot your password?</Link></p>
      </section>
    </main>
  ), uiLocale);
}
