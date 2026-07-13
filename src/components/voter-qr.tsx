"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Generates a voter self-service link for a person and shows it as a QR. */
export function VoterQr({
  personId,
  onDone,
  doneLabel = "Done — next student",
}: {
  personId: string;
  onDone: () => void;
  doneLabel?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/people/${personId}/link`, { method: "POST" }).then(async (r) => {
      if (!r.ok) return;
      const { url } = (await r.json()) as { url: string };
      setUrl(url);
      setQr(await QRCode.toDataURL(url, { width: 260, margin: 1 }));
    });
  }, [personId]);

  return (
    <div className="border border-hairline p-6 text-center max-w-sm bg-canvas">
      <p className="mb-3">Have the student scan this to open their private voting plan:</p>
      {qr ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qr} alt="Voter link QR code" className="mx-auto border border-hairline" />
      ) : (
        <p className="text-ink-muted py-16">Generating…</p>
      )}
      {url && (
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-[12px]">
          <button
            onClick={() => {
              navigator.clipboard.writeText(url);
              setCopied(true);
            }}
            className="text-primary hover:underline"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <a
            href={`mailto:?subject=Your voting plan&body=${encodeURIComponent(
              `Here's your private voting plan link:\n\n${url}\n\nIt expires in 14 days.`,
            )}`}
            className="text-primary hover:underline"
          >
            Send by email
          </a>
          <a
            href={`sms:?&body=${encodeURIComponent(`Your private voting plan: ${url}`)}`}
            className="text-primary hover:underline"
          >
            Send by text
          </a>
        </div>
      )}
      <div>
        <button
          onClick={onDone}
          className="mt-4 bg-primary text-white px-6 py-2.5 hover:bg-primary-hover"
        >
          {doneLabel}
        </button>
      </div>
    </div>
  );
}
