// ═══════════════════════════════════════════════════════════
// 🟪 LOGO ICON · TrocaES — SVG OFICIAL
// Quadrado roxo #7C3AED (rx 16) com seta branca → direita e
// seta laranja #FF6500 ← esquerda, traço 6, cantos arredondados.
// ═══════════════════════════════════════════════════════════
export default function LogoIcon({
  className = "w-10 h-10 sm:w-11 sm:h-11",
}: {
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      aria-label="TrocaES"
      role="img"
    >
      <rect width="64" height="64" rx="16" fill="#7C3AED" />
      <path
        d="M16 24h32l-8-8"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M48 40H16l8 8"
        fill="none"
        stroke="#FF6500"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
