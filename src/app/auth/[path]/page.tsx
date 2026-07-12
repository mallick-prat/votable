import { AuthView } from "@neondatabase/auth/react";

export const dynamicParams = false;

export function generateStaticParams() {
  return [
    "sign-in",
    "sign-up",
    "forgot-password",
    "reset-password",
    "magic-link",
    "two-factor",
    "callback",
    "sign-out",
  ].map((path) => ({ path }));
}

export default async function AuthPage({
  params,
}: {
  params: Promise<{ path: string }>;
}) {
  const { path } = await params;
  return (
    <div className="max-w-md mx-auto mt-12">
      <AuthView path={path} />
    </div>
  );
}
