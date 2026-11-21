import { useQuery } from "@tanstack/react-query";
import { Loader2, Square, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePreferences } from "@/lib/usePreferences";
import { LANGUAGE_OPTIONS, speak, speechSupported, stopSpeaking } from "@/lib/speech";
import type { ClassScore, Explanation } from "@/lib/types";

interface Props {
  classId: string;
  confidence: number;
  alternatives: ClassScore[];
  file: File | null;
  fallback: Explanation;
  online: boolean;
}

export function ExplanationPanel({ classId, confidence, alternatives, file, fallback, online }: Props) {
  const { language, setLanguage } = usePreferences();
  const [speaking, setSpeaking] = useState(false);

  const query = useQuery({
    queryKey: ["explain", classId, language, Math.round(confidence * 100), file?.name, file?.size],
    queryFn: () => api.explain({ classId, confidence, language, alternatives, image: file }),
    enabled: online,
    staleTime: Infinity,
    retry: 1,
  });
  const explanation = query.data ?? fallback;
  useEffect(() => () => stopSpeaking(), []);

  const toggleSpeech = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
    } else if (speak(explanation.text, explanation.translated ? language : "en", () => setSpeaking(false))) {
      setSpeaking(true);
    }
  };

  const source =
    explanation.provider === "gemini"
      ? `Written by Gemini${explanation.photo_aware ? " after looking at your photo" : ""}, using the reference notes below.`
      : explanation.provider === "ollama"
        ? "Written by a local AI model from the reference notes below."
        : "Built-in summary from the reference notes below.";

  return (
    <section aria-labelledby="explain-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="explain-heading" className="section-title">
          In plain words
        </h2>
        <div className="no-print flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="language">
            Language
          </label>
          <select
            id="language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-full border border-mist bg-sheet px-3 py-1.5 text-sm font-bold text-ink"
          >
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
          {speechSupported() && (
            <button className="btn-quiet px-3 py-1.5 text-sm" onClick={toggleSpeech} aria-pressed={speaking}>
              {speaking ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
              {speaking ? "Stop" : "Read aloud"}
            </button>
          )}
        </div>
      </div>

      <div className="relative rounded-2xl bg-sheet p-5">
        {query.isFetching && (
          <p className="mb-3 flex items-center gap-2 text-sm text-moss" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Writing an explanation…
          </p>
        )}
        <div className="max-w-prose whitespace-pre-line leading-relaxed">{explanation.text}</div>
        {!explanation.translated && language !== "en" && (
          <p className="mt-3 text-sm text-moss">
            Translation needs the AI service, which is not configured on this server, so this is shown in English.
          </p>
        )}
        <p className="mt-4 text-sm text-moss">{source}</p>
      </div>
    </section>
  );
}
