// Minimal ambient type declaration for the qrcode package (browser build).
// No @types/qrcode exists; this covers only the APIs used in this codebase.
declare module "qrcode" {
  interface QRCodeOptions {
    type?: string;
    width?: number;
    margin?: number;
    color?: { dark?: string; light?: string };
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  }

  /** Canvas-based dataURL (browser build). */
  function toDataURL(
    canvas: HTMLCanvasElement | string,
    text: string,
    opts?: QRCodeOptions,
  ): Promise<string>;
  function toDataURL(text: string, opts?: QRCodeOptions): Promise<string>;

  /** SVG string output. */
  function toString(
    text: string,
    opts: QRCodeOptions & { type: "svg" },
    cb: (err: Error | null, svg: string) => void,
  ): void;
  function toString(
    text: string,
    opts: QRCodeOptions & { type: "svg" },
  ): Promise<string>;

  /** Render to an existing canvas element. */
  function toCanvas(
    canvas: HTMLCanvasElement,
    text: string,
    opts?: QRCodeOptions,
    cb?: (err: Error | null) => void,
  ): void;
}
