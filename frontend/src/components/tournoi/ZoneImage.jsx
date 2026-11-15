import React, { useState, useEffect } from "react";

// Zone d'envoi d'image : clic, glisser-déposer ou coller (Ctrl+V) tant qu'elle est affichée
export function ZoneImage({ fichier, onChange, icone }) {
  const [survol, setSurvol] = useState(false);

  useEffect(() => {
    const coller = (e) => {
      for (const item of Array.from(e.clipboardData?.items || [])) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          onChange(item.getAsFile());
        }
      }
    };
    window.addEventListener("paste", coller);
    return () => window.removeEventListener("paste", coller);
  }, [onChange]);

  return (
    <label
      className={`cursor-pointer bg-white/5 hover:bg-white/10 border-2 border-dashed rounded-2xl p-6 flex flex-col items-center gap-2 transition-all group ${survol ? "border-primary-orange bg-primary-orange/10" : "border-white/10"}`}
      onDragOver={(e) => {
        e.preventDefault();
        setSurvol(true);
      }}
      onDragLeave={() => setSurvol(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSurvol(false);
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith("image/")) onChange(file);
      }}
    >
      <span className="text-3xl grayscale group-hover:grayscale-0 transition-all">{icone}</span>
      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">
        {fichier ? fichier.name : "Glisser-déposer, coller ou cliquer"}
      </span>
      <input type="file" className="hidden" accept="image/*" onChange={(e) => onChange(e.target.files[0])} />
    </label>
  );
}
