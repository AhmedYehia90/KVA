import {localizeUi} from "@/i18n/localize-ui";
import {useLocale as useUiLocale} from "next-intl";
export default function Page(){
  const uiLocale = useUiLocale();
return localizeUi(<main className="section"><div className="container"><div className="eyebrow">Crew center</div><h2>Become a Kalabsha Pilot</h2><div className="grid"><div className="card"><h3>Create profile</h3><p className="muted">Register your simulator and optional IVAO VID.</p></div><div className="card"><h3>Complete training</h3><p className="muted">Study procedures and pass the introduction.</p></div><div className="card"><h3>Start flying</h3><p className="muted">Book schedules and submit ACARS PIREPs.</p></div></div></div></main>, uiLocale)}