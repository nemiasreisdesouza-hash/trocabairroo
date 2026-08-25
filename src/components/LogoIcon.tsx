// ═══════════════════════════════════════════════════════════
// 🟪 LOGO ICON · TrocaES — quadrado roxo arredondado com setas
// de troca: branca (→ direita) e laranja (← esquerda)
// ═══════════════════════════════════════════════════════════
export default function LogoIcon({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="TrocaES"
      role="img"
    >
      {/* Fundo: quadrado roxo com bordas arredondadas */}
      <rect width="48" height="48" rx="12" fill="#7C3AED" />

      {/* Seta superior (→ direita) em branco */}
      <path
        d="M13 19H29"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M24.5 13.5L31 19l-6.5 5.5"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Seta inferior (← esquerda) em laranja vibrante */}
      <path
        d="M35 29H19"
        stroke="#FF6500"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M23.5 23.5L17 29l6.5 5.5"
        fill="none"
        stroke="#FF6500"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
