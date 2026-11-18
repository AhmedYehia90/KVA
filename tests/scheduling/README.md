# Isolated scheduling checks

See [the review report](../../docs/11-release/SCHEDULING_PHASE1_REVIEW.md).

Run `python tests/scheduling/test_phase1.py` against the labelled network-disabled disposable PostgreSQL container, then `python tests/scheduling/run_web_checks.py`. The latter runs sanitized `pnpm verify` and browser checks using local synthetic Auth/PostgREST and PostgreSQL only. `--reuse-build` is for rerunning browser-only checks against the unchanged, already verified LOCAL test build.

Do not provide production secrets or a hosted database URL. Do not deploy the test adapter or the staging SQL. No production migration is included.

## Real Supabase core integration (no API adapter)

See [the integration report](../../docs/11-release/SUPABASE_SCHEDULING_INTEGRATION.md).

```sh
python tests/scheduling/local_supabase.py
python tests/scheduling/test_supabase_integration.py
python tests/scheduling/test_supabase_browser.py
```

The provisioner uses a labelled internal Docker network and official Auth/PostgREST/Kong images with PostgreSQL 17 and all repository migrations. It accepts no hosted DSN. An existing verified synthetic stack can be reset with `python tests/scheduling/local_supabase.py --reset-test-schema`; this resets its public and private scheduling test schemas only. Keys/passwords are generated into a private directory outside Git and must never be copied into reports or production.

## Production-style prepared/OFF cutover

On the same verified disposable local Supabase stack, reset its synthetic public AND private scheduling test schemas with `local_supabase.py --reset-test-schema`. Never use a hosted DSN. Then run `test_production_cutover.py`. With an already verified local build for the same public configuration, `--browser-gates` also runs the real browser matrix during prepared/OFF mode. After the API suite, `test_supabase_browser.py --cutover --reuse-build` exercises the activated local mode. See the cutover review for the correct initial build/flag ordering.

The tests cover original function OID/ACL restoration, a real in-flight old booking racing activation, private/direct bypass rejection, real scheduled booking/cancellation/aircraft races, and data-preserving rollback refusal. These fixtures are never production accounts or schedules.
