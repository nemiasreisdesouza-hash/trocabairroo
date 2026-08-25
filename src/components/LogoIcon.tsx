// ═══════════════════════════════════════════════════════════
// 🟪 LOGO ICON · TrocaES — vetor HD
// Quadrado roxo #7C3AED com cantos arredondados e setas de troca:
// branca (→ direita) e laranja #FF6500 (← esquerda).
// shape-rendering=geometricPrecision + traço espesso = zero blur.
// ═══════════════════════════════════════════════════════════
export default function LogoIcon({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      shapeRendering="geometricPrecision"
      aria-label="TrocaES"
      role="img"
    >
      {/* Fundo: quadrado roxo profundo, cantos bem arredondados */}
      <rect width="48" height="48" rx="14" fill="#7C3AED" />

      {/* Seta superior (→ direita) em branco — traço espesso e nítido */}
      <path
        d="M12 18.5H29"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M24 12.5L31 18.5L24 24.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Seta inferior (← esquerda) em laranja vibrante */}
      <path
        d="M36 29.5H19"
        stroke="#FF6500"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M24 23.5L17 29.5L24 35.5"
        fill="none"
        stroke="#FF6500"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
