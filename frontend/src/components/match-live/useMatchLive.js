import { useState, useEffect, useRef } from "react";
import { getMatch, updateMatch } from "../../api";
import { usePolling } from "../../usePolling";
import { avecHeureReception, calculerChrono } from "./chrono";

// Charge le match, le rafraîchit régulièrement et fait tourner l'affichage du chrono.
export function useMatchLive(id) {
  const [match, setMatch] = useState(null);
  const [loading, setLoading] = useState(true);

  const matchRef = useRef(null);
  matchRef.current = match;
  // File d'envoi : les PATCH partent dans l'ordre des clics
  const fileEnvoiRef = useRef(Promise.resolve());

  const loadMatch = async () => {
    try {
      const response = await getMatch(id);
      setMatch(avecHeureReception(response.data));
    } catch (error) {
      console.error("Erreur:", error);
    } finally {
      setLoading(false);
    }
  };

  // Modifie le match et met l'écran à jour avec la réponse du serveur
  const patchMatch = async (updates) => {
    const envoi = fileEnvoiRef.current.then(() => updateMatch(id, updates));
    fileEnvoiRef.current = envoi.catch(() => {});
    const response = await envoi;
    setMatch(avecHeureReception(response.data));
  };

  usePolling(
    () => loadMatch(),
    () => {
      const m = matchRef.current;
      const enDirect = m?.statut === "en_cours" || m?.chrono_en_cours;
      return enDirect ? 3000 : 10000; // match à venir ou terminé : pas besoin de rafraîchir souvent
    },
    [id],
  );

  // Rafraîchit l'affichage du chrono (calcul local, aucune requête)
  const [maintenant, setMaintenant] = useState(Date.now());
  const chronoEnCours = Boolean(match?.chrono_en_cours);
  useEffect(() => {
    if (!chronoEnCours) return;
    const interval = setInterval(() => setMaintenant(Date.now()), 250);
    return () => clearInterval(interval);
  }, [chronoEnCours]);

  const chrono = match ? calculerChrono(match, maintenant) : null;
  const chronoAZero = Boolean(chrono?.aZero);
  useEffect(() => {
    if (chronoAZero) loadMatch();
  }, [chronoAZero]); // eslint-disable-line react-hooks/exhaustive-deps

  return { match, loading, chrono, loadMatch, patchMatch };
}
