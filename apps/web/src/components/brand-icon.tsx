import Image from 'next/image';

export function BrandIcon({ size, className }: { size: number; className?: string }) {
  return (
    <Image
      src="/Eye-RARYVizion.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
    />
  );
}
