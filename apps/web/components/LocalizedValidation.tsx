"use client";

import {useEffect} from "react";
import {useLocale} from "next-intl";

/** Localize the browser's own validation UI; the browser still enforces every constraint. */
export function LocalizedValidation() {
  const locale = useLocale();
  useEffect(() => {
    if (locale !== "ar") return;
    const managed = new Set<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>();
    function control(target: EventTarget | null) {
      return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement ? target : null;
    }
    function invalid(event: Event) {
      const field = control(event.target);
      if (!field || (field.validity.customError && !managed.has(field))) return;
      if (managed.has(field)) field.setCustomValidity("");
      const validity = field.validity;
      if (validity.valid) {
        managed.delete(field);
        return;
      }
      let message = "أدخل قيمة صحيحة.";
      if (validity.valueMissing) message = "هذا الحقل مطلوب.";
      else if (validity.typeMismatch) message = field instanceof HTMLInputElement && field.type === "email" ? "أدخل بريدًا إلكترونيًا صحيحًا." : "أدخل رابطًا صحيحًا.";
      else if (validity.patternMismatch) message = "أدخل قيمة بالتنسيق المطلوب.";
      else if (validity.tooShort && "minLength" in field) message = `أدخل ${field.minLength} أحرف على الأقل.`;
      else if (validity.tooLong && "maxLength" in field) message = `يجب ألا يتجاوز النص ${field.maxLength} حرفًا.`;
      else if (validity.rangeUnderflow && field instanceof HTMLInputElement) message = `يجب ألا تقل القيمة عن ${field.min}.`;
      else if (validity.rangeOverflow && field instanceof HTMLInputElement) message = `يجب ألا تزيد القيمة عن ${field.max}.`;
      else if (validity.stepMismatch) message = "أدخل قيمة ضمن الخطوات المحددة.";
      field.setCustomValidity(message);
      managed.add(field);
    }
    function clear(event: Event) {
      const field = control(event.target);
      if (field && managed.has(field)) {
        field.setCustomValidity("");
        managed.delete(field);
      }
    }
    document.addEventListener("invalid", invalid, true);
    document.addEventListener("input", clear, true);
    document.addEventListener("change", clear, true);
    return () => {
      document.removeEventListener("invalid", invalid, true);
      document.removeEventListener("input", clear, true);
      document.removeEventListener("change", clear, true);
      managed.forEach(field => field.setCustomValidity(""));
    };
  }, [locale]);
  return null;
}
