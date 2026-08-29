import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FeedbackVote, Icp, SearchRun, SentOutreach } from "@/lib/types";
import { applyFeedbackRerank, proposeIcpDiff, runSearch } from "@/lib/ranking";

const PROFILE_QUOTA = 300;
const REVEAL_QUOTA = 50;

type ProspectState = {
  searches: SearchRun[];
  profileUsed: number;
  revealUsed: number;
  createSearch: (input: {
    briefText: string;
    icp: Icp;
    sampleId?: string;
    results: SearchRun["results"];
  }) => SearchRun;
  completeSearch: (id: string, results: SearchRun["results"]) => void;
  reveal: (searchId: string, candidateId: string) => boolean;
  setOutreach: (searchId: string, candidateId: string, text: string) => void;
  markSent: (searchId: string, candidateId: string, info: SentOutreach) => void;
  vote: (searchId: string, candidateId: string, vote: FeedbackVote) => void;
  applyIcpDiff: (searchId: string) => void;
  dismissIcpDiff: (searchId: string) => void;
};

function uid(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export const useProspectStore = create<ProspectState>()(
  persist(
    (set, get) => ({
      searches: [],
      profileUsed: 0,
      revealUsed: 0,
      createSearch: ({ briefText, icp, sampleId, results }) => {
        const run: SearchRun = {
          id: uid(),
          createdAt: Date.now(),
          briefText,
          icp,
          sampleId,
          status: "running",
          results,
          revealed: [],
          outreach: {},
          sent: {},
          feedback: {},
        };
        set((s) => ({
          searches: [run, ...s.searches].slice(0, 24),
          profileUsed: Math.min(PROFILE_QUOTA, s.profileUsed + (results.length || 22)),
        }));
        return run;
      },
      completeSearch: (id, results) => {
        set((s) => ({
          searches: s.searches.map((run) =>
            run.id === id ? { ...run, status: "done", results } : run,
          ),
        }));
      },
      reveal: (searchId, candidateId) => {
        const state = get();
        const run = state.searches.find((s) => s.id === searchId);
        if (!run) return false;
        if (run.revealed.includes(candidateId)) return true;
        if (state.revealUsed >= REVEAL_QUOTA) return false;
        set((s) => ({
          revealUsed: s.revealUsed + 1,
          searches: s.searches.map((r) =>
            r.id === searchId ? { ...r, revealed: [...r.revealed, candidateId] } : r,
          ),
        }));
        return true;
      },
      setOutreach: (searchId, candidateId, text) => {
        set((s) => ({
          searches: s.searches.map((r) =>
            r.id === searchId
              ? { ...r, outreach: { ...r.outreach, [candidateId]: text } }
              : r,
          ),
        }));
      },
      markSent: (searchId, candidateId, info) => {
        set((s) => ({
          searches: s.searches.map((r) =>
            r.id === searchId
              ? { ...r, sent: { ...(r.sent ?? {}), [candidateId]: info } }
              : r,
          ),
        }));
      },
      vote: (searchId, candidateId, vote) => {
        set((s) => {
          const run = s.searches.find((r) => r.id === searchId);
          if (!run) return s;
          const feedback = { ...run.feedback, [candidateId]: vote };
          const results = applyFeedbackRerank(run.results, feedback);
          const downTag = vote.vote === "down" ? vote.tags[0] : undefined;
          const pendingIcpDiff = downTag ? proposeIcpDiff(run.icp, downTag) : run.pendingIcpDiff;
          return {
            searches: s.searches.map((r) =>
              r.id === searchId ? { ...r, feedback, results, pendingIcpDiff } : r,
            ),
          };
        });
      },
      applyIcpDiff: (searchId) => {
        set((s) => ({
          searches: s.searches.map((r) => {
            if (r.id !== searchId || !r.pendingIcpDiff) return r;
            const icp: Icp = {
              ...r.icp,
              must: [...r.icp.must, ...r.pendingIcpDiff.addMust],
              disqualifiers: [
                ...r.icp.disqualifiers,
                ...r.pendingIcpDiff.addDisqualifiers,
              ],
            };
            const results = applyFeedbackRerank(runSearch(icp), r.feedback);
            return { ...r, icp, results, pendingIcpDiff: undefined };
          }),
        }));
      },
      dismissIcpDiff: (searchId) => {
        set((s) => ({
          searches: s.searches.map((r) =>
            r.id === searchId ? { ...r, pendingIcpDiff: undefined } : r,
          ),
        }));
      },
    }),
    { name: "prospect-v1" },
  ),
);

export const QUOTAS = { profiles: PROFILE_QUOTA, reveals: REVEAL_QUOTA };

export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = useProspectStore.persist;
    if (api.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return api.onFinishHydration(() => setHydrated(true));
  }, []);
  return hydrated;
}
