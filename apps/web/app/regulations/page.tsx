import type {Metadata} from "next";
import {readFile} from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import {getLocale} from "next-intl/server";
import {constitutionContent} from "@/lib/privacy/legal-content";

export async function generateMetadata(): Promise<Metadata> {
  return {title: (await getLocale()) === "ar" ? "لائحة KVA OS" : "KVA OS Regulations"};
}

export default async function RegulationsPage() {
  const locale = await getLocale();
  const source = await readFile(path.resolve(process.cwd(), "../../docs/CONSTITUTION.md"), "utf8");
  const content = constitutionContent(source, locale);
  return (
    <main className="section"><article className="container">
      <div className="eyebrow">KVA OS</div>
      <h1>{locale === "ar" ? "لائحة KVA OS" : "KVA OS Regulations"}</h1>
      <ol>{content.principles.map(principle => <li key={principle}>{principle}</li>)}</ol>
      <section className="section" id="pilot-data-protection">
        <h2>{locale === "ar" ? "حماية بيانات الطيارين وخصوصيتهم" : "Pilot Data Protection & Privacy"}</h2>
        <ul>{content.privacy.map(principle => <li key={principle}>{principle}</li>)}</ul>
        <Link href="/privacy">{locale === "ar" ? "سياسة الخصوصية" : "Privacy Policy"}</Link>
      </section>
    </article></main>
  );
}
