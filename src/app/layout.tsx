import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { Nav } from "@/components/nav";
import { AuthProvider } from "@/components/auth-provider";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["300", "400", "600"],
});

export const metadata: Metadata = {
  title: "Voteable",
  description: "Campus voter registration and vote-plan operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plex.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <StoreProvider>
            <Nav />
            <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 md:px-8 py-6 pb-24">
              {children}
            </main>
          </StoreProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
