import { Html5QrcodeScanner } from "html5-qrcode";
import { QrCode } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEFAULT_QR = "liverlink-qr";

type Props = {
  onScan: (value: string) => void;
  active?: boolean;
};

export function QRScanner({ onScan, active = true }: Props) {
  const containerId = useRef(`${DEFAULT_QR}-${Math.random().toString(36).slice(2)}`);
  const scanner = useRef<Html5QrcodeScanner | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      if (scanner.current) {
        scanner.current.clear().catch(() => undefined);
        scanner.current = null;
      }
      return;
    }
    const hostElement = document.getElementById(containerId.current);
    if (hostElement) {
      hostElement.innerHTML = "";
    }
    const instance = new Html5QrcodeScanner(containerId.current, {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      showTorchButtonIfSupported: true,
      rememberLastUsedCamera: true,
    });
    scanner.current = instance;

    instance.render(
      (decoded) => {
        onScan(decoded);
        setError(null);
      },
      (scanError) => {
        setError(scanError.message);
      }
    );

    return () => {
      instance.clear().catch(() => undefined);
      scanner.current = null;
    };
  }, [active, onScan]);

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-medical-blue/20 text-medical-blue">
        <QrCode className="h-7 w-7" />
      </div>
      <p className="text-lg font-semibold text-slate-100">Scan donor QR</p>
      <p className="text-xs text-slate-500">Camera opens automatically to capture donor wristband.</p>
      <div id={containerId.current} className="mt-4" />
      {error && <p className="mt-2 text-xs text-medical-red">{error}</p>}
    </div>
  );
}
