import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  // Staff surfaces require a signed-in session. Voter links (/v/…) are
  // deliberately public — the signed token is the credential.
  matcher: [
    "/",
    "/people/:path*",
    "/canvass",
    "/field",
    "/team",
    "/import",
    "/account/:path*",
  ],
};
