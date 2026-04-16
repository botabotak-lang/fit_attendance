import Image from "next/image";

/** ヘッダー用ロゴ（`public/fit-logo.png`）。ファイルが大きい場合は圧縮推奨。 */
export function AppBrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/fit-logo.png"
      alt="FIT"
      width={200}
      height={40}
      unoptimized
      priority
      className={`h-9 max-h-10 w-auto max-w-[10rem] object-contain object-left sm:max-w-[12rem] ${className}`.trim()}
    />
  );
}
