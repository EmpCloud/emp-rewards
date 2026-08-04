import { useEffect, useRef, useState } from "react";
import { Globe } from "lucide-react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "en", label: "English", short: "EN" }, { code: "hi", label: "हिन्दी", short: "HI" },
  { code: "es", label: "Español", short: "ES" }, { code: "fr", label: "Français", short: "FR" },
  { code: "de", label: "Deutsch", short: "DE" }, { code: "ar", label: "العربية", short: "AR" },
  { code: "pt", label: "Português", short: "PT" }, { code: "ja", label: "日本語", short: "JA" },
  { code: "zh", label: "中文", short: "ZH" },
];
export function LanguageSwitcher() {
  const { t, i18n } = useTranslation(); const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  const code = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0]; const current = LANGUAGES.find((x) => x.code === code) || LANGUAGES[0];
  useEffect(() => { const close = (event: MouseEvent) => { if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  return <div ref={ref} className="relative"><button type="button" onClick={() => setOpen((x) => !x)} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-100" aria-label={t("Change language")}><Globe className="h-4 w-4"/><span className="text-xs font-medium">{current.short}</span></button>{open && <div className="lms-language-menu absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg">{LANGUAGES.map((language) => <button type="button" key={language.code} onClick={() => { void i18n.changeLanguage(language.code); setOpen(false); }} className={`lms-language-option flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${code === language.code ? "bg-brand-50 font-medium text-brand-700" : "text-gray-700"}`}><span className="w-6 text-center text-xs font-bold text-gray-400">{language.short}</span>{language.label}</button>)}</div>}</div>;
}
