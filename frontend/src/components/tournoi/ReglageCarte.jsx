import React, { useCallback, useState } from "react";
import { messageErreur, updateTournoi } from "../../api";
import { compresserImage } from "../../images";
import { useRetours } from "../retours/contexte";
import { BandeauCarte } from "./BandeauCarte";
import { COULEURS_CARTE, couleurCarte } from "./carte";
import { ZoneImage } from "./ZoneImage";

// Carte du tournoi dans « Mes tournois » : une couleur de la palette, ou une photo. Enregistré à chaque choix.
export function ReglageCarte({ tournoi, recharger }) {
  const retours = useRetours();
  const [enCours, setEnCours] = useState(false);
  // Affiché tout de suite, sans attendre le rechargement du tournoi
  const [apercu, setApercu] = useState(null);

  const enregistrer = async (donnees, message) => {
    setEnCours(true);
    try {
      const { data } = await updateTournoi(tournoi.slug, donnees);
      setApercu(data);
      retours.succes(message);
      recharger();
    } catch (err) {
      retours.erreur(messageErreur(err, "Impossible d'enregistrer la carte du tournoi"));
    } finally {
      setEnCours(false);
    }
  };

  const envoyerPhoto = useCallback(
    async (fichier) => {
      if (!fichier || enCours) return;
      const donnees = new FormData();
      donnees.append("carte_image", await compresserImage(fichier));
      enregistrer(donnees, "Photo de la carte enregistrée.");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournoi.slug, enCours],
  );

  const carte = { ...tournoi, ...(apercu?.slug === tournoi.slug ? apercu : {}) };
  const couleurActive = couleurCarte(carte);

  return (
    <div className="border-b border-white/5 pb-6">
      <h3 className="text-lg font-black uppercase text-primary-orange mb-2 tracking-wider">Carte du tournoi</h3>
      <p className="text-xs text-gray-500 mb-6 italic">
        * Le haut de la carte dans « Mes tournois » et sur l'accueil : une couleur avec les initiales, ou une photo.
      </p>
      <div className="grid md:grid-cols-2 gap-6 items-start">
        <div className="rounded-2xl overflow-hidden border border-white/10">
          <BandeauCarte tournoi={carte} className="h-32" />
          <div className="p-4 bg-white/5">
            <span className="font-black uppercase text-sm truncate block">{carte.nom}</span>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <span className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">Couleur</span>
            <div className="flex flex-wrap gap-2">
              {COULEURS_CARTE.map((couleur) => (
                <button
                  key={couleur}
                  type="button"
                  disabled={enCours}
                  onClick={() => enregistrer({ carte_couleur: couleur }, "Couleur de la carte enregistrée.")}
                  aria-label={`Couleur ${couleur}`}
                  aria-pressed={couleurActive === couleur}
                  className={`w-10 h-10 rounded-xl transition-all disabled:opacity-50 ${couleurActive === couleur ? "ring-2 ring-white ring-offset-2 ring-offset-black scale-110" : "hover:scale-105"}`}
                  style={{ backgroundColor: couleur }}
                />
              ))}
            </div>
          </div>
          <div>
            <span className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">Photo</span>
            <ZoneImage fichier={null} onChange={envoyerPhoto} icone="🖼️" />
            {carte.carte_image && (
              <button
                type="button"
                disabled={enCours}
                onClick={() => enregistrer({ carte_image: null }, "Photo retirée.")}
                className="mt-3 text-xs font-black uppercase tracking-widest text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
              >
                ✕ Retirer la photo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
