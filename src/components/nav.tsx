"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@neondatabase/auth/react";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/people", label: "People" },
  { href: "/canvass", label: "Canvass" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 bg-canvas border-b border-hairline">
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 h-12 flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[16px]">
          <span className="w-3 h-3 bg-primary inline-block" aria-hidden />
          Voteable
        </Link>
        <nav className="flex h-full">
          {LINKS.map((l) => {
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
