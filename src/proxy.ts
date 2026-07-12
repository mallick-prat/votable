import { auth } from "@/lib/auth/server";

export default auth.middleware({
  loginUrl: "/auth/sign-in",
});

export const config = {
  // The whole app handles student PII — everything except the auth pages
  // and the auth API requires a signed-in session.
  matcher: ["/", "/people/:path*", "/canvass", "/account/:path*"],
};
