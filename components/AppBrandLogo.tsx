import Image from "next/image";

/** ヘッダー用ロゴ（`public/fit-logo.png`、元解像度 2816×1536 想定） */
export function AppBrandLogo({ className = "" }: { className?: string }) {
  return (
    <Image
      src="/fit-logo.png"
      alt="FIT"
      width={176}
      height={96}
      sizes="(max-width: 640px) 42vw, 12rem"
      priority
      className={`h-9 max-h-10 w-auto max-w-[10rem] object-contain object-left sm:max-w-[12rem] ${className}`.trim()}
    />
  );
}
