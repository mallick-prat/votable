"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ContactOutcome, OUTCOME_TO_STATUS, Person } from "./types";

interface ImportResult {
  added: number;
  skipped: number;
  errors: string[];
}

interface Store {
  people: Person[];
  ready: boolean;
  update: (id: string, patch: Partial<Person>) => void;
  recordOutcome: (id: string, outcome: ContactOutcome) => void;
  undoOutcome: (id: string) => void;
  importRoster: (text: string) => Promise<ImportResult>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/people");
    if (!res.ok) return; // signed out — page access is gated by the proxy
    const { people } = (await res.json()) as { people: Person[] };
    setPeople(people);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- server data can only arrive after mount
    refresh().finally(() => setReady(true));
  }, [refresh]);

  // Optimistic mutations: apply locally, send to the server, re-sync on failure.
  const update = useCallback(
    (id: string, patch: Partial<Person>) => {
      setPeople((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
      fetch(`/api/people/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).then((r) => {
        if (!r.ok) refresh();
      });
    },
    [refresh],
  );

  const recordOutcome = useCallback(
    (id: string, outcome: ContactOutcome) => {
      setPeople((ps) =>
        ps.map((p) =>
          p.id === id
            ? {
                ...p,
                contactStatus: OUTCOME_TO_STATUS[outcome],
                history: [
                  ...p.history,
                  { outcome, at: new Date().toISOString() },
                ],
              }
            : p,
        ),
      );
      fetch(`/api/people/${id}/outcomes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcome }),
      }).then((r) => {
        if (!r.ok) refresh();
      });
    },
    [refresh],
  );

  const undoOutcome = useCallback(
    (id: string) => {
      setPeople((ps) =>
        ps.map((p) => {
          if (p.id !== id || p.history.length === 0) return p;
          const history = p.history.slice(0, -1);
          const last = history[history.length - 1];
          return {
            ...p,
            history,
            contactStatus: last
              ? OUTCOME_TO_STATUS[last.outcome]
              : "uncontacted",
          };
        }),
      );
      fetch(`/api/people/${id}/outcomes`, { method: "DELETE" }).then((r) => {
        if (!r.ok) refresh();
      });
    },
    [refresh],
  );

  const importRoster = useCallback(
    async (text: string): Promise<ImportResult> => {
      const res = await fetch("/api/people/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return { added: 0, skipped: 0, errors: ["Import failed"] };
      const result = (await res.json()) as ImportResult;
      await refresh();
      return result;
    },
    [refresh],
  );

  return (
    <StoreContext.Provider
      value={{ people, ready, update, recordOutcome, undoOutcome, importRoster }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
