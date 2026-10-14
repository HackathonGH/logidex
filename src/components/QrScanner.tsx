import { Scanner } from "@yudiel/react-qr-scanner";

/** Camera QR reader. Browser-only: load with React.lazy behind <ClientOnly>. */
export default function QrScanner({ onCode, onError }: { onCode: (v: string) => void; onError: () => void }) {
  return (
    <Scanner
      onScan={(codes) => { const v = codes[0]?.rawValue; if (v) onCode(v); }}
      onError={onError}
      constraints={{ facingMode: "environment" }}
    />
  );
}
