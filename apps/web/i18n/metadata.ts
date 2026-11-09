import type {Metadata} from "next";
import {localizeText} from "./localize-ui";

export function localizeMetadata(metadata: Metadata, locale: string): Metadata {
  if (locale !== "ar") return metadata;
  const title = metadata.title;
  let translatedTitle: Metadata["title"] = title;
  if (typeof title === "string") {
    translatedTitle = localizeText(title, locale);
  } else if (title && "absolute" in title) {
    translatedTitle = {...title, absolute: localizeText(title.absolute, locale)};
  } else if (title && "default" in title) {
    translatedTitle = {...title, default: localizeText(title.default, locale), template: localizeText(title.template, locale)};
  }
  return {
    ...metadata,
    title: translatedTitle,
    description: metadata.description ? localizeText(metadata.description, locale) : metadata.description,
  };
}
