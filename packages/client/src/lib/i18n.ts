import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import hi from "@/locales/hi.json";
import es from "@/locales/es.json";
import fr from "@/locales/fr.json";
import de from "@/locales/de.json";
import ar from "@/locales/ar.json";
import pt from "@/locales/pt.json";
import ja from "@/locales/ja.json";
import zh from "@/locales/zh.json";

export const SUPPORTED_LANGUAGES = ["en", "hi", "es", "fr", "de", "ar", "pt", "ja", "zh"] as const;
const savedLanguage = localStorage.getItem("emp-rewards-language") || "en";
const resources = { en: { translation: en }, hi: { translation: hi }, es: { translation: es }, fr: { translation: fr }, de: { translation: de }, ar: { translation: ar }, pt: { translation: pt }, ja: { translation: ja }, zh: { translation: zh } };

i18n.use(initReactI18next).init({ resources, lng: savedLanguage, fallbackLng: "en", keySeparator: false, interpolation: { escapeValue: false } });
function applyLanguage(language: string) { const code = language.split("-")[0]; document.documentElement.lang = code; document.documentElement.dir = code === "ar" ? "rtl" : "ltr"; }
applyLanguage(savedLanguage);
i18n.on("languageChanged", (language) => { localStorage.setItem("emp-rewards-language", language); applyLanguage(language); });
export function tr(text: string | null | undefined): string { return text == null ? "" : String(i18n.t(text)); }
export default i18n;
