"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR code of this certificate's URL (without query parameters), so a printed or on screen certificate opens on a phone. */
export function CertificateQr() {
  const [src, setSrc] = useState<string>();
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const here = `${window.location.origin}${window.location.pathname}`;
    QRCode.toDataURL(here, { margin: 1, width: 192, errorCorrectionLevel: "M" })
      .then((data) => {
        setSrc(data);
        setUrl(here);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center gap-3">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-white p-1">
        {src && (
          // A generated data URL; next/image adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={url ? `QR code for ${url}` : ""} width={88} height={88} className="h-full w-full" />
        )}
      </div>
      <p className="text-xs text-muted">Scan to open this certificate and check it on Arc.</p>
    </div>
  );
}
