import { useEffect, useState } from "react";
import type { MoveAnalysis } from "./bot";

type AnalysisState = { pgn: string; analyses: Record<number, MoveAnalysis>; failed: boolean };
const completedAnalyses = new Map<string, Record<number, MoveAnalysis>>();

// Results and replay use the same engine and cached completed analysis.
export function useGameAnalysis(pgn: string) {
  const [state, setState] = useState<AnalysisState>(() => ({ pgn, analyses: completedAnalyses.get(pgn) ?? {}, failed: false }));
  useEffect(() => {
    let active = true;
    const cached = completedAnalyses.get(pgn);
    setState({ pgn, analyses: cached ?? {}, failed: false });
    if (cached) return;
    let worker: Worker | undefined;
    const collected: Record<number, MoveAnalysis> = {};
    const fail = () => { if (active) setState({ pgn, analyses: { ...collected }, failed: true }); worker?.terminate(); };
    try {
      worker = new Worker(new URL("./review.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<{ index?: number; analysis?: MoveAnalysis; error?: boolean; done?: boolean }>) => {
        if (!active) return;
        const { index, analysis, error, done } = event.data;
        if (error) { fail(); return; }
        if (index !== undefined && analysis) { collected[index] = analysis; setState({ pgn, analyses: { ...collected }, failed: false }); }
        if (done) {
          completedAnalyses.set(pgn, { ...collected });
          if (completedAnalyses.size > 24) completedAnalyses.delete(completedAnalyses.keys().next().value!);
          worker?.terminate();
        }
      };
      worker.onerror = fail;
      worker.postMessage(pgn);
    } catch { fail(); }
    return () => { active = false; worker?.terminate(); };
  }, [pgn]);
  return state.pgn === pgn ? state : { pgn, analyses: {}, failed: false };
}
