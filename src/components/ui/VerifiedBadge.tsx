"use client";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const sizeMap: Record<Size, string> = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
};

type VerifiedBadgeProps = {
  isVerified?: boolean | null;
  isPartner?: boolean | null;
  size?: Size;
  className?: string;
};

/**
 * DESIGN SYSTEM - VerifiedBadge único oficial
 * Geometria: Roseta Oficial de 12 pontas arredondadas (Meta/Instagram/X)
 * - Mesmo SVG para Gold e Azul, apenas cor muda
 * - Gold (Parceiro): #EAB308 / text-amber-500
 * - Azul (Verificado): #0095F6 / text-blue-500
 * - Check branco vazado no centro
 */
export default function VerifiedBadge({
  isVerified,
  isPartner,
  size = "sm",
  className = "",
}: VerifiedBadgeProps) {
  if (!isPartner && !isVerified) return null;

  const fill = isPartner ? "#EAB308" : "#0095F6";

  return (
    <svg
      viewBox="0 0 24 24"
      className={`${sizeMap[size]} flex-shrink-0 ${className}`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Roseta oficial 12 pontas arredondadas - path idêntico BadgeCheck lucide */}
      <path
        d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
        fill={fill}
      />
      {/* Check branco central */}
      <path
        d="m9 12 2 2 4-4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
