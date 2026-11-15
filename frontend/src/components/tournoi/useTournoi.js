import { useState, useEffect, useRef } from "react";
import {
  getTournoi,
  getEquipes,
  getMatchs,
  getJoueursTournoi,
  getClassement,
  getTournamentMVP,
} from "../../api";

// Données d'un tournoi : infos, équipes, joueurs, matchs, classement et MVP de l'onglet choisi.
export function useTournoi(slug, typeClassement) {
  const [tournoi, setTournoi] = useState(null);
  const [equipes, setEquipes] = useState([]);
  const [matchs, setMatchs] = useState([]);
  const [joueursParEquipe, setJoueursParEquipe] = useState({});
  const [classement, setClassement] = useState([]);
  const [tournamentMVP, setTournamentMVP] = useState([]);
  const [loading, setLoading] = useState(true);
  // Clé (slug + onglet) du classement déjà chargé, pour ne pas le recharger deux fois
  const classementChargeRef = useRef(null);

  const recharger = async () => {
    if (!slug) return;
    setLoading(true);
    try {
      // Toutes les requêtes partent en même temps : l'API accepte le slug partout
      const [tournoiRes, equipesRes, matchsRes, classementRes, mvpRes, joueursRes] = await Promise.allSettled([
        getTournoi(slug),
        getEquipes(slug),
        getMatchs(slug),
        getClassement(slug, typeClassement),
        getTournamentMVP(slug, typeClassement),
        getJoueursTournoi(slug),
      ]);
      classementChargeRef.current = `${slug}|${typeClassement}`;

      // Une erreur sur une requête ne bloque pas les autres
      const liste = (res, nom) => {
        if (res.status !== "fulfilled") {
          console.error(`Erreur ${nom}:`, res.reason);
          return [];
        }
        return Array.isArray(res.value.data) ? res.value.data : [];
      };

      if (tournoiRes.status !== "fulfilled") throw tournoiRes.reason;
      setTournoi(tournoiRes.value.data);

      const listeEquipes = liste(equipesRes, "Equipes");
      setEquipes(listeEquipes);
      setMatchs(liste(matchsRes, "Matchs"));
      setClassement(liste(classementRes, "Classement"));
      setTournamentMVP(liste(mvpRes, "MVP"));

      const parEquipe = Object.fromEntries(listeEquipes.map((eq) => [eq.id, []]));
      for (const joueur of liste(joueursRes, "Joueurs")) {
        (parEquipe[joueur.equipe] = parEquipe[joueur.equipe] || []).push(joueur);
      }
      setJoueursParEquipe(parEquipe);
    } catch (error) {
      console.error("Erreur lors du chargement des données:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    recharger();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Changement d'onglet (poules / éliminatoires) : seuls le classement et le MVP changent
  useEffect(() => {
    const cle = `${slug}|${typeClassement}`;
    if (!tournoi?.slug || classementChargeRef.current === cle) return;
    classementChargeRef.current = cle;
    getClassement(tournoi.slug, typeClassement)
      .then((res) => setClassement(res.data || []))
      .catch((err) => console.error("Erreur Classement:", err));
    getTournamentMVP(tournoi.slug, typeClassement)
      .then((res) => setTournamentMVP(res.data || []))
      .catch((err) => console.error("Erreur MVP:", err));
  }, [typeClassement, tournoi?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  return { tournoi, equipes, matchs, joueursParEquipe, classement, tournamentMVP, loading, recharger };
}
