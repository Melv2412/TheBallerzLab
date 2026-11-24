import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getImageUrl, getTournoiVedette } from "../api";
import { useAuth } from "../AuthContext";
import { usePolling } from "../usePolling";
import { ImageSecours } from "./ImageSecours";
import { LogoEquipe } from "./tournoi/LogoEquipe";

const CLE = "thelab:vedette";
const IMAGE_DEFAUT = "/images/backgrounds/streetball-calm.jpg";

const lire = () => {
  try {
    return sessionStorage.getItem(CLE);
  } catch {
    return null;
  }
};
const garder = (slug) => {
  try {
    if (slug) sessionStorage.setItem(CLE, slug);
    else sessionStorage.removeItem(CLE);
  } catch {
    // stockage indisponible (navigation privée) : on retire au hasard à chaque fois
  }
};

const dateCourte = (date) => new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const chrono = (secondes = 0) =>
  `${String(Math.floor(secondes / 60)).padStart(2, "0")}:${String(secondes % 60).padStart(2, "0")}`;

function EquipeMatch({ equipe, score, gagne }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-9 h-9 rounded-lg bg-white/10 overflow-hidden flex items-center justify-center shrink-0">
        <LogoEquipe equipe={equipe} icone="text-base" />
      </div>
      <span className="flex-1 truncate font-black uppercase text-sm">{equipe?.nom}</span>
      <span className={`text-2xl font-black tabular-nums ${gagne ? "text-white" : "text-gray-400"}`}>{score}</span>
    </div>
  );
}

function MatchVedette({ match }) {
  const direct = match.statut === "en_cours";
  const periode =
    match.periode_actuelle > match.nb_periodes ? "Prolongation" : `Période ${match.periode_actuelle}`;
  return (
    <Link
      to={`/match/${match.id}`}
      className={`block rounded-2xl p-4 border-2 transition-all hover:bg-white/10 ${direct ? "border-red-500/60 bg-red-500/5" : "border-white/10 bg-white/5"}`}
    >
      <div className="flex items-center justify-between mb-3 text-[10px] font-black uppercase tracking-widest">
        {direct ? (
          <>
            <span className="text-red-400">● Direct</span>
            <span className="text-gray-400">
              {periode} · {chrono(match.temps_restant_secondes)}
            </span>
          </>
        ) : (
          <span className="text-gray-400">
            Terminé{match.date_match && ` · ${dateCourte(match.date_match)}`}
          </span>
        )}
      </div>
      <div className="space-y-2">
        <EquipeMatch
          equipe={match.equipe_domicile}
          score={match.score_domicile}
          gagne={!direct && match.score_domicile > match.score_exterieur}
        />
        <EquipeMatch
          equipe={match.equipe_exterieur}
          score={match.score_exterieur}
          gagne={!direct && match.score_exterieur > match.score_domicile}
        />
      </div>
    </Link>
  );
}

// Un tournoi en cours mis en avant en haut de l'accueil : un des siens pour un compte, un public pour un visiteur.
// Tiré une fois par visite (gardé jusqu'à la fermeture de l'onglet) ; rien ne s'affiche s'il n'y en a pas.
export function TournoiVedette() {
  const { user } = useAuth();
  const [donnees, setDonnees] = useState(null);
  // Lu juste après le chargement, avant le nouveau rendu : on ne peut pas se fier à `donnees`
  const enDirect = useRef(false);

  usePolling(
    async () => {
      try {
        const { data } = await getTournoiVedette(lire());
        garder(data.tournoi?.slug);
        enDirect.current = data.match?.statut === "en_cours";
        setDonnees(data);
      } catch {
        // le bloc est un bonus : en cas d'erreur, on ne montre rien
      }
    },
    () => (enDirect.current ? 15000 : null),
    [user?.id],
  );

  const tournoi = donnees?.tournoi;
  if (!tournoi) return null;
  const match = donnees.match;
  const image = getImageUrl(tournoi.carte_image) || IMAGE_DEFAUT;

  return (
    <section className="glass-card overflow-hidden mb-10 grid md:grid-cols-[1.4fr_1fr]">
      <div className="relative min-h-[220px] md:min-h-[300px]">
        <ImageSecours src={image} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        <span className="absolute left-5 top-5 bg-primary-orange text-white px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
          En cours
        </span>
        <div className="absolute left-5 right-5 bottom-5">
          <h2 className="text-3xl md:text-4xl font-black italic uppercase leading-tight">{tournoi.nom}</h2>
          <p className="text-gray-300 font-bold text-xs uppercase mt-2">
            {new Date(tournoi.date_debut).toLocaleDateString("fr-FR")} -{" "}
            {new Date(tournoi.date_fin).toLocaleDateString("fr-FR")}
          </p>
        </div>
      </div>

      <div className="p-5 md:p-6 flex flex-col gap-4">
        {match && <MatchVedette match={match} />}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="block text-[10px] text-gray-500 font-black uppercase tracking-tighter">Équipes</span>
            <span className="text-xl font-black">{tournoi.equipes_count || 0}</span>
          </div>
          <div className="bg-white/5 rounded-xl p-3 border border-white/5">
            <span className="block text-[10px] text-gray-500 font-black uppercase tracking-tighter">Joueurs</span>
            <span className="text-xl font-black">{tournoi.joueurs_count || 0}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 mt-auto">
          <Link to={`/tournoi/${tournoi.slug}`} className="btn-basketball flex-1 flex items-center justify-center gap-2">
            Ouvrir le tournoi <span>➔</span>
          </Link>
          <Link
            to={`/tournoi/${tournoi.slug}?onglet=matchs`}
            className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all font-black uppercase text-xs tracking-widest flex items-center justify-center"
          >
            Calendrier
          </Link>
        </div>
      </div>
    </section>
  );
}

export default TournoiVedette;
