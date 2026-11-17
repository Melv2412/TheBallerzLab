import React from "react";
import { MatchCard } from "./MatchCard";

export function OngletCalendrier({ matchs, equipes, isOwner, onSupprimerMatch }) {
  const matchsPoule = matchs.filter((m) => m.phase === "poule");
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl sm:text-4xl font-black italic mb-6 card-title-accent uppercase">Calendrier des Matchs</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {matchsPoule.map((match) => (
          <MatchCard key={match.id} match={match} equipes={equipes} onDelete={onSupprimerMatch} isOwner={isOwner} />
        ))}
        {matchsPoule.length === 0 && (
          <div className="md:col-span-2 glass-card p-10 text-center opacity-40">Aucun match programmé en phase de poule.</div>
        )}
      </div>
    </div>
  );
}
