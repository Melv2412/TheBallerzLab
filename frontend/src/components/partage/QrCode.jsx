import React, { useMemo } from "react";
import { traceQr } from "./partage";

// QR code en SVG : net à toutes les tailles (télé, impression). Fond blanc obligatoire pour être scanné
export function QrCode({ url, className = "", titre = "QR code" }) {
  const { trace, taille } = useMemo(() => traceQr(url), [url]);
  return (
    <svg
      viewBox={`0 0 ${taille} ${taille}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={titre}
      className={`bg-white rounded-lg ${className}`}
    >
      <path d={trace} fill="#000" />
    </svg>
  );
}

// Image PNG du QR code (à imprimer ou envoyer), avec une légende sous le code
export const qrEnPng = (url, legende, cote = 1024) => {
  const { trace, taille } = traceQr(url);
  const hauteurLegende = legende ? Math.round(cote * 0.12) : 0;
  const canvas = document.createElement("canvas");
  canvas.width = cote;
  canvas.height = cote + hauteurLegende;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(cote / taille, cote / taille);
  ctx.fillStyle = "#000";
  ctx.fill(new Path2D(trace));
  ctx.restore();
  if (legende) {
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(cote * 0.05)}px system-ui, sans-serif`;
    ctx.fillText(legende.slice(0, 40), cote / 2, cote + hauteurLegende * 0.45, cote * 0.92);
  }
  return new Promise((resoudre) => canvas.toBlob(resoudre, "image/png"));
};
