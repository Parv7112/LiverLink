import {
  Html5Qrcode,
  Html5QrcodeCameraScanConfig,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import jsQR from "jsqr";
import { QrCode } from "lucide-react";
import { ChangeEvent, useEffect, useRef, useState } from "react";

const DEFAULT_QR = "liverlink-qr";

type Props = {
  onScan: (value: string) => void;
  active?: boolean;
};

export function QRScanner({ onScan, active = true }: Props) {
  const containerId = useRef(`${DEFAULT_QR}-${Math.random().toString(36).slice(2)}`);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const scanner = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualDecodeError, setManualDecodeError] = useState<string | null>(null);
  const [manualProcessing, setManualProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraStatus, setCameraStatus] = useState<string>("Initializing camera…");

  const safeStop = async (engine: Html5Qrcode | null) => {
    if (!engine) return;
    try {
      const instance: any = engine;
      if (typeof instance.isScanning === "function" && !instance.isScanning()) {
        return;
      }
      await engine.stop();
    } catch (stopError: any) {
      const message = `${stopError?.message ?? stopError}`;
      if (!message.includes("scanner is not running or paused")) {
        console.warn("Unable to stop QR scanner", stopError);
      }
    }
  };

  const safeClear = async (engine: Html5Qrcode | null) => {
    if (!engine) return;
    try {
      await engine.clear();
    } catch {
      // ignore
    }
  };

  const applyVideoStyles = () => {
    const host = hostRef.current;
    if (!host) return;
    const video = host.querySelector("video") as HTMLVideoElement | null;
    const canvas = host.querySelector("canvas") as HTMLCanvasElement | null;
    if (video) {
      video.style.position = "absolute";
      video.style.top = "0";
      video.style.left = "0";
      video.style.width = "100%";
      video.style.height = "100%";
      video.style.objectFit = "cover";
      video.style.borderRadius = "1.25rem";
    }
    if (canvas) {
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.borderRadius = "1.25rem";
      canvas.style.opacity = "0";
      canvas.style.pointerEvents = "none";
    }
  };

  useEffect(() => {
    applyVideoStyles();
    const host = hostRef.current;
    if (!host) return;
    const observer = new MutationObserver(() => applyVideoStyles());
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const startCamera = async () => {
      if (!active) {
        setCameraStatus("Camera paused.");
        await safeStop(scanner.current);
        await safeClear(scanner.current);
        scanner.current = null;
        return;
      }

      setCameraStatus("Initializing camera…");
      try {
        const existing = scanner.current;
        if (existing) {
          await safeStop(existing);
          await safeClear(existing);
        }

        const instance = new Html5Qrcode(containerId.current, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scanner.current = instance;

        console.log("[QRScanner] Requesting camera access...");
        const cameras = await Html5Qrcode.getCameras();
        console.log(`[QRScanner] Found ${cameras.length} cameras:`, cameras);
        
        if (!cameras.length) {
          console.warn("[QRScanner] No cameras detected");
          setCameraStatus("No camera detected. Upload a QR image instead.");
          setError("No camera found. Please use the upload option or check camera permissions.");
          return;
        }

        const config: Html5QrcodeCameraScanConfig = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        };

        console.log(`[QRScanner] Starting camera with ID: ${cameras[0].id}`);
        await instance.start(
          { deviceId: { exact: cameras[0].id } },
          config,
          (decoded) => {
            if (cancelled) return;
            console.log("[QRScanner] QR decoded:", decoded);
            onScan(decoded);
            setError(null);
            setManualDecodeError(null);
            setCameraStatus("QR captured.");
          },
          (scanError) => {
            if (cancelled) return;
            const message = `${scanError}`;
            if (
              message.includes("NotFoundException") ||
              message.includes("No code could be detected")
            ) {
              setCameraStatus("Align the wristband QR inside the square.");
            } else {
              setCameraStatus("Camera active, waiting for QR…");
            }
          }
        );
        console.log("[QRScanner] Camera started successfully");
        setCameraStatus("Camera active. Hold the QR steady.");
      } catch (cameraError: any) {
        if (!cancelled) {
          console.error("[QRScanner] Camera error:", cameraError);
          const errorMsg = cameraError?.message ?? "Unable to initialize camera.";
          
          // Provide specific error messages for common issues
          let userMessage = errorMsg;
          if (errorMsg.includes("Permission denied") || errorMsg.includes("NotAllowedError")) {
            userMessage = "Camera permission denied. Please allow camera access in your browser settings.";
          } else if (errorMsg.includes("NotFoundError") || errorMsg.includes("not found")) {
            userMessage = "No camera found on this device. Please use the upload option.";
          } else if (errorMsg.includes("NotReadableError")) {
            userMessage = "Camera is in use by another application. Please close other apps and refresh.";
          } else if (errorMsg.includes("NotSupportedError") || errorMsg.includes("HTTPS")) {
            userMessage = "Camera requires HTTPS connection. Please ensure you're using a secure connection.";
          }
          
          setCameraStatus("Camera unavailable. Use the upload option below.");
          setError(userMessage);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      safeStop(scanner.current);
      safeClear(scanner.current);
      scanner.current = null;
    };
  }, [active, onScan]);

  const decodeWithJsQr = async (file: File): Promise<string> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Unable to read file."));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Unable to load image."));
      img.src = dataUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas context unavailable.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "attemptBoth",
    });
    if (!result?.data) {
      throw new Error("Offline decoder could not detect a QR code.");
    }
    return result.data;
  };

  const handleManualUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    setManualProcessing(true);
    setManualDecodeError(null);
    try {
      const decoded = await decodeWithJsQr(file);
      onScan(decoded);
      setError(null);
    } catch (uploadError: any) {
      setManualDecodeError(uploadError?.message ?? "Unable to decode QR image.");
    } finally {
      setManualProcessing(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-medical-blue/20 text-medical-blue">
        <QrCode className="h-7 w-7" />
      </div>
      <p className="text-lg font-semibold text-slate-100">Scan donor QR</p>
      <p className="text-xs text-slate-500">{cameraStatus}</p>
      <div className="relative mt-4 w-full overflow-hidden rounded-2xl bg-black/40" style={{ minHeight: 320 }}>
        <div ref={hostRef} className="relative h-full w-full">
          <div id={containerId.current} className="absolute inset-0" />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-medical-red">{error}</p>}
      <div className="mt-4 space-y-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-semibold uppercase tracking-widest text-medical-blue underline-offset-2 hover:underline"
        >
          Upload QR image instead
        </button>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          className="hidden"
          onChange={handleManualUpload}
        />
        {manualProcessing && <p className="text-xs text-slate-400">Decoding image...</p>}
        {manualDecodeError && <p className="text-xs text-medical-red">{manualDecodeError}</p>}
      </div>
    </div>
  );
}
