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

The provisioner uses a labelled internal Docker network and official Auth/PostgREST/Kong images with PostgreSQL 17 and all repository migrations. It accepts no hosted DSN. An existing verified synthetic stack can be reset with `python tests/scheduling/local_supabase.py --reset-test-schema`; this resets its public test schema only. Keys/passwords are generated into a private directory outside Git and must never be copied into reports or production.
