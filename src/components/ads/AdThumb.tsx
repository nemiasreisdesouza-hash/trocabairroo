"use client";

import { useEffect, useState } from "react";
import {
  Utensils,
  Scissors,
  Palette,
  GraduationCap,
  Calendar,
  Camera,
  Laptop,
  Megaphone,
  Shirt,
  Music,
  Heart,
  Home as HomeIcon,
  ShoppingBag,
  Video,
  Store,
} from "lucide-react";

function getCategoryIcon(categoria: string) {
  const c = (categoria || "").toLowerCase();
  if (c.includes("aliment")) return Utensils;
  if (c.includes("beleza") || c.includes("estética")) return Scissors;
  if (c.includes("design") || c.includes("arte")) return Palette;
  if (c.includes("educa")) return GraduationCap;
  if (c.includes("evento")) return Calendar;
  if (c.includes("foto")) return Camera;
  if (c.includes("informática") || c.includes(" ti") || c.includes("tecnologia")) return Laptop;
  if (c.includes("marketing")) return Megaphone;
  if (c.includes("moda") || c.includes("costura")) return Shirt;
  if (c.includes("música") || c.includes("musica")) return Music;
  if (c.includes("saúde") || c.includes("bem-estar") || c.includes("saude")) return Heart;
  if (c.includes("doméstico") || c.includes("domestico") || c.includes("serviço")) return HomeIcon;
  if (c.includes("vendas") || c.includes("comércio") || c.includes("comercio")) return ShoppingBag;
  if (c.includes("vídeo") || c.includes("video") || c.includes("produção") || c.includes("producao")) return Video;
  return Store;
}

function isValidUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (trimmed.length < 10) return false;
  if (trimmed === "undefined" || trimmed === "null") return false;
  // [SEC-FIX] CWE-79: only allow data:image or https/http
  return (
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://")
  );
}

export default function AdThumb({
  url,
  category,
  className = "w-full h-full object-cover",
  placeholderClassName,
}: {
  url?: string | null;
  category?: string;
  className?: string;
  placeholderClassName?: string;
}) {
  const validInitial = isValidUrl(url);
  const [ok, setOk] = useState(validInitial);

  useEffect(() => {
    setOk(isValidUrl(url));
  }, [url]);

  if (!isValidUrl(url) || !ok) {
    const IconCat = getCategoryIcon(category || "");
    return (
      <div
        className={
          placeholderClassName ||
          "w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-100 to-purple-200 gap-2"
        }
      >
        <IconCat className="w-10 h-10 text-purple-400" />
        {category && (
          <span className="text-[10px] font-semibold text-purple-600 uppercase tracking-wider">
            {category}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={url!}
      alt=""
      className={className}
      onError={() => setOk(false)}
      loading="lazy"
    />
  );
}
