import React, { useState } from "react";
import { getImageUrl } from "../api";

// Image qui laisse place à `secours` si elle n'existe pas ou ne se charge pas (fichier effacé, réseau…)
export function ImageSecours({ src, alt = "", className = "w-full h-full object-cover", secours = null }) {
  const [urlEnErreur, setUrlEnErreur] = useState(null);
  const url = getImageUrl(src);
  if (!url || url === urlEnErreur) return secours;
  return <img src={url} alt={alt} className={className} onError={() => setUrlEnErreur(url)} />;
}
