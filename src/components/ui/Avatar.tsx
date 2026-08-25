"use client";

import { getInitials } from "@/lib/utils";

type AvatarProps = {
  src?: string | null;
  name: string;
  size?: "xxs" | "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

const sizes = {
  xxs: "w-[22px] h-[22px] text-[9px]", // 22px — rodapé premium do AdCard
  xs: "w-6 h-6 text-[10px]",
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-lg",
  xl: "w-20 h-20 text-2xl",
};

export default function Avatar({ src, name, size = "md", className = "" }: AvatarProps) {
  const sizeClass = sizes[size];

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 ${className}`}
    >
      {getInitials(name)}
    </div>
  );
}
