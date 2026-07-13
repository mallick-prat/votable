"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ContactOutcome, OUTCOME_TO_STATUS, Person, Staff } from "./types";

type DeniedReason = "not_allowed" | "unverified";

interface Store {
  me: Staff | null;
  people: Person[];
  ready: boolean;
  /** contact outcomes recorded offline, waiting to sync */
  pendingSync: number;
  refresh: () => Promise<void>;
  update: (id: string, patch: Partial<Person>) => void;
  recordOutcome: (id: string, outcome: ContactOutcome) => void;
  undoOutcome: (id: string) => void;
}

// ------------------------------------------------------------ offline outbox
// Contact outcomes recorded without a connection queue here (localStorage)
// and flush when the connection returns. Deliberately outcomes-only: that is
// the one mutation organizers make standing at a door.

interface OutboxEntry {
  kind: "outcome" | "undo";
  personId: string;
  outcome?: ContactOutcome;
}

const OUTBOX_KEY = "voteable-outbox-v1";

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? "[]") as OutboxEntry[];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
}

async function sendEntry(e: OutboxEntry): Promise<boolean> {
  try {
    const res =
      e.kind === "outcome"
        ? await fetch(`/api/people/${e.personId}/outcomes`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outcome: e.outcome }),
          })
        : await fetch(`/api/people/${e.personId}/outcomes`, { method: "DELETE" });
    return res.ok;
  } catch {
    return false; // still offline
  }
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Staff | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState<DeniedReason | null>(null);
  const [pendingSync, setPendingSync] = useState(0);
  const pathname = usePathname();

  // Voter links and auth pages don't load staff data at all.
  const publicPage =
    pathname.startsWith("/v/") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/account");

  const refresh = useCallback(async () => {
    const meRes = await fetch("/api/me");
    if (meRes.status === 403) {
      const body = (await meRes.json()) as { error?: string };
      setDenied(body.error === "unverified" ? "unverified" : "not_allowed");
      return;
    }
    if (!meRes.ok) return; // signed out — page access is gated by the proxy
    const { me } = (await meRes.json()) as { me: Staff };
    setDenied(null);
    setMe(me);

    const res = await fetch("/api/people");
    if (!res.ok) return;
    const { people } = (await res.json()) as { people: Person[] };
    setPeople(people);
  }, []);

  // Flush queued offline outcomes in order; stop at the first failure.
  const flushOutbox = useCallback(async () => {
    let entries = readOutbox();
    let sent = false;
    while (entries.length > 0 && (await sendEntry(entries[0]))) {
      entries = entries.slice(1);
      writeOutbox(entries);
      sent = true;
    }
    setPendingSync(entries.length);
    if (sent) await refresh();
  }, [refresh]);

  useEffect(() => {
    if (publicPage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- marks the provider ready; no data load on public pages
      setReady(true);
      return;
    }
     
    setPendingSync(readOutbox().length);
    refresh()
      .then(() => flushOutbox())
      .finally(() => setReady(true));
    const onOnline = () => flushOutbox();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh, publicPage, flushOutbox]);

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
      })
        .then((r) => {
          if (!r.ok) refresh();
        })
        .catch(() => {
          // Offline: keep the optimistic update and queue for sync.
          writeOutbox([...readOutbox(), { kind: "outcome", personId: id, outcome }]);
          setPendingSync(readOutbox().length);
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
      fetch(`/api/people/${id}/outcomes`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok) refresh();
        })
        .catch(() => {
          const outbox = readOutbox();
          const last = outbox[outbox.length - 1];
          // Undoing an outcome that itself is still queued just cancels it.
          if (last?.kind === "outcome" && last.personId === id) {
            writeOutbox(outbox.slice(0, -1));
          } else {
            writeOutbox([...outbox, { kind: "undo", personId: id }]);
          }
          setPendingSync(readOutbox().length);
        });
    },
    [refresh],
  );

  if (ready && denied && !publicPage) {
    return (
      <div className="max-w-md mx-auto mt-24 border border-hairline p-8 text-center">
        <h1 className="text-[24px] font-light">
          {denied === "unverified"
            ? "Verify your email"
            : "Account not authorized"}
        </h1>
        <p className="text-ink-muted mt-3">
          {denied === "unverified"
            ? "This account's email address is unverified. Sign in with Google, or verify the address from the email we sent."
            : "This account isn't on the campaign access list. Sign in with an authorized account."}
        </p>
        <Link
          href="/auth/sign-out"
          className="inline-block mt-6 bg-primary text-white px-4 py-2 hover:bg-primary-hover"
        >
          Switch account
        </Link>
      </div>
    );
  }

  return (
    <StoreContext.Provider
      value={{
        me,
        people,
        ready,
        pendingSync,
        refresh,
        update,
        recordOutcome,
        undoOutcome,
      }}
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
