# Arabic display localization

The request locale is still owned by next-intl (`request.ts` and the `KVA_LOCALE` cookie).
Existing message namespaces continue to use next-intl. Shared Arabic display copy lives in
`ui-ar.json`; `ui-patterns-ar.json` contains anchored templates for system-generated messages
with flight numbers, counts and other recorded values. Brand names, technical identifiers,
user-authored content without a translation, and code/JSON evidence remain unchanged.

Components localize their own returned React output with `localizeUi(output, locale)`.
Async server components obtain the locale with `getLocale`; synchronous components and
client components use `useLocale`. This happens during rendering, with no DOM rewriting,
translation service, network calls or extra client component per text node. Component
references are never invoked by the localizer.

Only text children and display/accessibility attributes are translated. Links, CSS classes,
form field names, action functions, event handlers, and submitted values are preserved.
Options with implicit values retain their original value when their label is translated.
Use `translate="no"` or `data-no-localize` for content that must be verbatim; `code`, `pre`,
`script` and `style` are excluded automatically. Do not translate state codes before using
them for business decisions. Add complete phrases or explicit templates, not partial-word
substitutions. Keep all template placeholders present in both languages.

Metadata uses `localizeMetadata`. Date/number formatters receive the request locale.
Styles use CSS logical positioning/spacing so both directions share the same rules;
`styles/rtl.css` handles Arabic typography, chevrons and Latin form inputs.

Run `pnpm --filter @kalabsha/web test:i18n`, `pnpm lint` and `pnpm build`.
Verify Arabic/English switching, mobile widths, submitted option values, accessible labels,
and the protected pilot/operations pages with a test account. Do not submit operational
forms or mutate production data as part of localization verification.
