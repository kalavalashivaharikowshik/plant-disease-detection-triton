import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { percent } from "@/lib/format";
import type { ClassScore, Comparison, Evidence, Question, RefineResult } from "@/lib/types";

interface Props {
  comparison: Comparison;
  evidence: Evidence[];
  candidates: ClassScore[];
  onRefined: (result: RefineResult) => void;
}

export function ComparePanel({ comparison, evidence, candidates, onRefined }: Props) {
  const [answers, setAnswers] = useState<Record<string, "yes" | "no" | "unsure">>({});
  const [question, setQuestion] = useState<Question | null>(comparison.question);
  const [ranked, setRanked] = useState<ClassScore[] | null>(null);

  const refine = useMutation({
    mutationFn: (next: Record<string, "yes" | "no" | "unsure">) => api.refine(candidates, next),
    onSuccess: (result) => {
      setRanked(result.ranked);
      setQuestion(result.next_question);
      onRefined(result);
    },
  });

  const answer = (value: "yes" | "no" | "unsure") => {
    if (!question) return;
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    refine.mutate(next);
  };

  return (
    <section aria-labelledby="compare-heading" className="space-y-4 rounded-2xl border-2 border-turmeric bg-sheet p-5">
      <div>
        <h2 id="compare-heading" className="section-title">
          Is it this, or that?
        </h2>
        <p className="mt-1 text-sm">The AI is torn between two answers. Compare where it looked, then check one sign on your plant.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {comparison.candidates.map((c) => {
          const ev = evidence.find((e) => e.class_id === c.class_id);
          const live = ranked?.find((r) => r.class_id === c.class_id);
          return (
            <article key={c.class_id} className="space-y-2">
              {ev && <img src={ev.image} alt={`Where the AI saw signs of ${c.display_name}`} className="w-full rounded-lg" />}
              <h3 className="font-display text-lg font-bold">
                {c.display_name} <span className="font-sans text-base font-normal">{percent(live?.confidence ?? c.confidence)}</span>
              </h3>
              <p className="text-sm">
                <span className="font-bold text-ink">Tell-tale sign: </span>
                {c.key_sign}
              </p>
            </article>
          );
        })}
      </div>

      {question ? (
        <div className="rounded-xl bg-turmeric-soft p-4">
          <p className="font-bold text-ink">{question.text}</p>
          <p className="mt-1 text-sm">{question.help}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn-primary" disabled={refine.isPending} onClick={() => answer("yes")}>
              Yes
            </button>
            <button className="btn-quiet" disabled={refine.isPending} onClick={() => answer("no")}>
              No
            </button>
            <button className="btn-quiet" disabled={refine.isPending} onClick={() => answer("unsure")}>
              Not sure
            </button>
          </div>
        </div>
      ) : (
        Object.keys(answers).length > 0 && (
          <p className="text-sm font-bold text-ink">Thanks. The result above has been updated with your answers.</p>
        )
      )}
      {refine.isError && <p role="alert" className="text-sm font-bold text-rust">{(refine.error as Error).message}</p>}
    </section>
  );
}
