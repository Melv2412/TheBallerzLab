import React, { useEffect, useState } from "react";
import { getPhasesFinales } from "../../api";

// État des séries de chaque phase finale ; rechargé quand `cle` change (ex. la liste des matchs)
export function usePhasesFinales(slug, cle) {
  const [phases, setPhases] = useState([]);
  useEffect(() => {
    let actif = true;
    getPhasesFinales(slug)
      .then((r) => actif && setPhases(r.data))
      .catch((e) => console.error("Erreur phases finales:", e));
    return () => {
      actif = false;
    };
  }, [slug, cle]);
  return phases;
}

export const formatSerie = (victoiresRequises) =>
  victoiresRequises > 1 ? `Au meilleur des ${victoiresRequises * 2 - 1} matchs` : "Match unique";

// Bandeau d'une série : « A  2 – 1  B », vainqueur mis en avant
export function CarteSerie({ serie, victoiresRequises }) {
  const [a, b] = serie.equipes;
  const style = (equipe) =>
    serie.vainqueur == null
      ? "text-white"
      : serie.vainqueur === equipe.id
        ? "text-primary-orange"
        : "text-gray-600 line-through";
  return (
    <div className="flex items-center justify-between gap-3 bg-black/40 border border-white/10 rounded-2xl px-4 py-3">
      <span className={`flex-1 min-w-0 truncate font-black italic uppercase ${style(a)}`}>{a.nom}</span>
      <span className="shrink-0 text-2xl font-black italic digital-font text-white">
        {a.victoires} <span className="text-gray-600">–</span> {b.victoires}
      </span>
      <span className={`flex-1 min-w-0 truncate text-right font-black italic uppercase ${style(b)}`}>{b.nom}</span>
      {victoiresRequises > 1 && serie.vainqueur == null && (
        <span className="hidden sm:inline shrink-0 text-[9px] font-black uppercase tracking-widest text-gray-500">
          {victoiresRequises} victoires
        </span>
      )}
    </div>
  );
}

// Vue d'ensemble des séries (onglet Classement > Phases éliminatoires)
export function ResumeSeries({ phases }) {
  const avecSeries = phases.filter((p) => p.series.length > 0);
  return (
    <div className="lg:col-span-2 glass-card overflow-hidden">
      <div className="p-5 sm:p-8 border-b border-white/5">
        <h2 className="text-xl sm:text-2xl font-black italic uppercase tracking-tight flex items-center gap-3">
          Tableau éliminatoire
        </h2>
      </div>
      <div className="p-4 sm:p-6 space-y-6">
        {avecSeries.length === 0 ? (
          <div className="p-6 text-center text-gray-500 italic">Les phases finales n'ont pas encore commencé.</div>
        ) : (
          avecSeries.map((phase) => (
            <div key={phase.phase}>
              <h3 className="text-sm font-black uppercase tracking-widest text-primary-orange mb-3">
                {phase.libelle} <span className="text-gray-600 normal-case tracking-normal">· {formatSerie(phase.victoires_requises)}</span>
              </h3>
              <div className="space-y-2">
                {phase.series.map((serie) => (
                  <CarteSerie key={serie.matchs[0]} serie={serie} victoiresRequises={phase.victoires_requises} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
