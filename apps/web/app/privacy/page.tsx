import type {Metadata} from "next";
import Link from "next/link";
import {getLocale} from "next-intl/server";
import {privacyPolicy} from "@/lib/privacy/legal-content";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {title: privacyPolicy[locale === "ar" ? "ar" : "en"].title};
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const content = privacyPolicy[locale === "ar" ? "ar" : "en"];
  return (
    <main className="section"><article className="container">
      <div className="eyebrow">KVA OS</div>
      <h1>{content.title}</h1>
      <p className="muted">{content.updated}</p>
      <p>{content.introduction}</p>
      {content.sections.map(section => (
        <section className="section" key={section.title}>
          <h2>{section.title}</h2><p>{section.body}</p>
        </section>
      ))}
      <p><a href="mailto:admin@kvafly.com">{locale === "ar" ? "التواصل بشأن الخصوصية" : "Privacy contact"}: admin@kvafly.com</a></p>
      <Link href="/regulations">{locale === "ar" ? "اللائحة وحماية بيانات الطيارين" : "Regulations and pilot data protection"}</Link>
    </article></main>
  );
}
