"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";

const LINKS: { href: string; label: string; roles: Role[] }[] = [
  { href: "/", label: "Dashboard", roles: ["admin", "captain", "organizer"] },
  { href: "/people", label: "People", roles: ["admin", "captain", "organizer"] },
  { href: "/canvass", label: "Canvass", roles: ["admin", "captain", "organizer"] },
  { href: "/turfs", label: "Turfs", roles: ["admin", "captain"] },
  { href: "/field", label: "Field", roles: ["admin", "captain", "organizer", "field"] },
  { href: "/team", label: "Team", roles: ["admin", "captain"] },
];

export function Nav() {
  const pathname = usePathname();
  const { me } = useStore();

  // Voter self-service pages get a plain wordmark, no staff chrome.
  if (pathname.startsWith("/v/")) {
    return (
      <header className="bg-canvas border-b border-hairline">
        <div className="max-w-[1100px] mx-auto px-4 md:px-8 h-12 flex items-center gap-2 font-semibold text-[16px]">
          <span className="w-3 h-3 bg-primary inline-block" aria-hidden />
          Voteable
        </div>
      </header>
    );
  }

  const links = me ? LINKS.filter((l) => l.roles.includes(me.role)) : [];

  return (
    <header className="sticky top-0 z-20 bg-canvas border-b border-hairline">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 h-12 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[16px]">
          <span className="w-3 h-3 bg-primary inline-block" aria-hidden />
          Voteable
        </Link>
        <nav className="flex h-full">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`flex items-center px-4 h-full border-b-2 -mb-px ${
                  active
                    ? "border-primary text-ink font-semibold"
                    : "border-transparent text-ink-muted hover:text-ink"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center">
          <SignedOut>
            <Link href="/auth/sign-in" className="text-primary hover:underline">
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <UserButton size="icon" />
          </SignedIn>
        </div>
      </div>
    </header>
  );
}
