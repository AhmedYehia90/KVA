import {Children, cloneElement, isValidElement, type ReactElement, type ReactNode} from "react";
import arabic from "./ui-ar.json";
import patterns from "./ui-patterns-ar.json";

const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
const translations = new Map(
  Object.entries(arabic).map(([source, translation]) => [normalize(source).toLowerCase(), translation]),
);

const phrasePatterns = Object.entries(patterns).map(([source, translation]) => {
  const names: string[] = [];
  const escaped = source.split(/(\{[a-z]+\})/i).map(part => {
    if (/^\{[a-z]+\}$/i.test(part)) {
      names.push(part.slice(1, -1));
      return "(.+?)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return {expression: new RegExp(`^${escaped}$`, "i"), names, translation};
});

/** Translate display copy only. Never use this for stored values, identifiers or commands. */
export function localizeText(value: string, locale: string): string {
  if (locale !== "ar" || !value.trim() || /[\u0621-\u064a]/.test(value)) return value;
  const text = normalize(value);
  if (/^[←→\s]+$/.test(text)) return mirror(value);
  const exact = translations.get(text.toLowerCase());
  if (exact) return preserveSpacing(value, exact);

  for (const pattern of phrasePatterns) {
    const match = text.match(pattern.expression);
    if (match) return preserveSpacing(value, pattern.translation.replace(/\{([a-z]+)\}/gi, (_, name: string) => {
      const captured = match[pattern.names.indexOf(name) + 1];
      return captured.length < text.length ? localizeText(captured, locale) : captured;
    }));
  }
  // Labels frequently surround a count or a directional navigation arrow.
  const decorated = text.match(/^([←→·:,↔\s]*)(.*?)([←→·:,↔\s]*)$/);
  if (decorated) {
    if (decorated[2] && decorated[2].length < text.length) {
      const translated = localizeText(decorated[2], locale);
      if (translated !== decorated[2]) return preserveSpacing(value, `${mirror(decorated[1])}${translated}${mirror(decorated[3])}`);
    }
  }
  // Preserve route/aircraft identifiers while localizing compound headings and metadata.
  const parts = text.split(/(\s+[|·]\s+)/);
  if (parts.length > 1) return preserveSpacing(value, parts.map(part => localizeText(part, locale)).join(""));
  const count = text.match(/^([-+\d\u0660-\u0669][\d\u0660-\u0669,.\u066b\u066c]*\s+)(.+)$|^(.+?)(\s+[-+\d\u0660-\u0669][\d\u0660-\u0669,.\u066b\u066c]*%?)$/);
  if (count) {
    const label = count[2] ?? count[3];
    const translated = translations.get(label.toLowerCase());
    if (translated) return preserveSpacing(value, count[1] ? `${count[1]}${translated}` : `${translated}${count[4]}`);
  }
  const status = text.replace(/_/g, " ");
  const translatedStatus = translations.get(status.toLowerCase());
  return translatedStatus ? preserveSpacing(value, translatedStatus) : value;
}

function preserveSpacing(source: string, translated: string) {
  return `${source.match(/^\s*/)?.[0] ?? ""}${translated}${source.match(/\s*$/)?.[0] ?? ""}`;
}

function mirror(value: string) {
  return value.replace(/[←→]/g, arrow => arrow === "←" ? "→" : "←");
}

const displayAttributes = ["title", "alt", "placeholder", "aria-label", "aria-description", "label"];

/** Localize rendered text and accessible labels without altering application data or form values.
 * Each component calls this on its own output; component types are never invoked here.
 */
export function localizeUi<T extends ReactNode>(node: T, locale: string): T {
  if (locale !== "ar") return node;
  function visit(child: ReactNode): ReactNode {
    if (typeof child === "string") return localizeText(child, locale);
    if (Array.isArray(child)) return child.map((entry, index) => {
      const translated = visit(entry);
      return isValidElement(translated) && translated.key === null
        ? cloneElement(translated, {key: `ui-${index}`})
        : translated;
    });
    if (!isValidElement(child)) return child;
    const element = child as ReactElement<Record<string, unknown>>;
    // Source snippets, route codes and JSON evidence must remain verbatim.
    if ((typeof element.type === "string" && ["script", "style", "code", "pre"].includes(element.type)) || element.props.translate === "no" || element.props["data-no-localize"]) return child;
    const props: Record<string, unknown> = {};
    for (const attribute of displayAttributes) {
      if (typeof element.props[attribute] === "string") props[attribute] = localizeText(element.props[attribute] as string, locale);
    }
    if (element.type === "option" && element.props.value === undefined) {
      // An option without value submits its original label, not the translated label.
      props.value = Children.toArray(element.props.children as ReactNode).join("");
    }
    if (element.props.children !== undefined) props.children = visit(element.props.children as ReactNode);
    return cloneElement(element, props);
  }
  return visit(node) as T;
}
