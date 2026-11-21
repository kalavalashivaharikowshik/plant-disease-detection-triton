// Read text aloud with the browser's built-in speech synthesis (free, works offline on most phones).

export const LANGUAGE_OPTIONS: Array<{ code: string; label: string; voice: string }> = [
  { code: "en", label: "English", voice: "en-IN" },
  { code: "hi", label: "हिन्दी (Hindi)", voice: "hi-IN" },
  { code: "te", label: "తెలుగు (Telugu)", voice: "te-IN" },
  { code: "ta", label: "தமிழ் (Tamil)", voice: "ta-IN" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)", voice: "kn-IN" },
  { code: "mr", label: "मराठी (Marathi)", voice: "mr-IN" },
];

export const speechSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;

export function findVoice(language: string): SpeechSynthesisVoice | undefined {
  if (!speechSupported()) return undefined;
  const target = LANGUAGE_OPTIONS.find((l) => l.code === language)?.voice ?? "en-IN";
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === target) ??
    voices.find((v) => v.lang.startsWith(target.split("-")[0])) ??
    undefined
  );
}

export function speak(text: string, language: string, onEnd?: () => void): boolean {
  if (!speechSupported()) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/[#*_]/g, ""));
  const voice = findVoice(language);
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang ?? LANGUAGE_OPTIONS.find((l) => l.code === language)?.voice ?? "en-IN";
  utterance.rate = 0.95;
  utterance.onend = () => onEnd?.();
  utterance.onerror = () => onEnd?.();
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking() {
  if (speechSupported()) window.speechSynthesis.cancel();
}
