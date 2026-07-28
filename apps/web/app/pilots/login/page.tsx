import {login} from "./actions";

type Props = {
  searchParams: Promise<{error?: string}>;
};

export default async function PilotLoginPage({searchParams}: Props) {
  const {error} = await searchParams;

  return (
    <main className="authPage">
      <section className="authCard">
        <div className="eyebrow">KVA Crew Portal</div>
        <h1>Pilot Login</h1>
        <p className="muted">
          Sign in with your registered Kalabsha Airlines pilot account.
        </p>

        {error ? (
          <div className="authError" role="alert">
            {error === "missing"
              ? "Enter your email and password."
              : "The email or password is incorrect."}
          </div>
        ) : null}

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
      </section>
    </main>
  );
}
