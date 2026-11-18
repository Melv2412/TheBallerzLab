import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { envoyerPhotoAthlete, getAthlete, getImageUrl, messageErreur, supprimerPhotoAthlete } from "../api";
import { useAuth } from "../AuthContext";
import { compresserImage } from "../images";
import { ImageSecours } from "./ImageSecours";

const STATS = [
  { cle: "points", label: "Points" },
  { cle: "rebonds", label: "Rebonds" },
  { cle: "passes", label: "Passes" },
  { cle: "contres", label: "Contres" },
  { cle: "fautes", label: "Fautes" },
];

const COULEURS_RESULTAT = {
  champion: "bg-yellow-400 text-black",
  elimine: "bg-white/10 text-gray-300",
  en_cours: "bg-primary-orange/20 text-primary-orange",
  poule: "bg-white/5 text-gray-400",
};

function Chiffre({ valeur, label }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-3xl font-black">{valeur}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{label}</p>
    </div>
  );
}

// Photo de profil : le joueur relié à la fiche la change ; elle est compressée dans le navigateur avant l'envoi
function Photo({ profil, modifiable, onChange }) {
  const champ = useRef(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const photo = getImageUrl(profil.photo);

  const envoyer = async (requete) => {
    setEnvoi(true);
    setErreur("");
    try {
      const { data } = await requete();
      onChange(data);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible d'enregistrer la photo."));
    } finally {
      setEnvoi(false);
    }
  };

  const choisir = (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = ""; // permet de rechoisir le même fichier
    if (fichier) envoyer(async () => envoyerPhotoAthlete(profil.id, await compresserImage(fichier)));
  };

  return (
    <div className="flex flex-col items-center gap-2 shrink-0">
      <div className="relative w-28 h-28 rounded-full overflow-hidden bg-white/10 flex items-center justify-center">
        <ImageSecours src={profil.photo} alt={`${profil.prenom} ${profil.nom}`} secours={<span className="text-4xl">👤</span>} />
        {envoi && <div className="absolute inset-0 bg-black/60 flex items-center justify-center text-xs animate-pulse">Envoi…</div>}
      </div>
      {modifiable && (
        <div className="flex gap-3 text-[10px] font-black uppercase tracking-widest">
          <button type="button" onClick={() => champ.current?.click()} disabled={envoi} className="text-primary-orange hover:underline disabled:opacity-50">
            {photo ? "Changer" : "Ajouter une photo"}
          </button>
          {profil.photo_perso && (
            <button type="button" onClick={() => envoyer(() => supprimerPhotoAthlete(profil.id))} disabled={envoi} className="text-gray-500 hover:text-red-400 disabled:opacity-50">
              Retirer
            </button>
          )}
          <input ref={champ} type="file" accept="image/*" className="hidden" onChange={choisir} />
        </div>
      )}
      {erreur && <p className="text-xs text-red-400 max-w-[200px] text-center">{erreur}</p>}
    </div>
  );
}

// Profil public : carrière cumulée sur tous les tournois, puis le détail tournoi par tournoi
export default function ProfilAthlete() {
  const { id } = useParams();
  const { user } = useAuth();
  const [profil, setProfil] = useState(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    setProfil(null);
    setErreur(false);
    getAthlete(id)
      .then(({ data }) => setProfil(data))
      .catch(() => setErreur(true));
  }, [id]);

  if (erreur) return <div className="text-center py-10">Profil introuvable.</div>;
  if (!profil) return <div className="text-center py-10 animate-pulse">Chargement du profil...</div>;

  const { carriere } = profil;
  const monProfil = user?.athlete != null && String(user.athlete) === String(profil.id);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <header className="glass-card p-6 flex flex-col sm:flex-row items-center gap-6">
        <Photo profil={profil} modifiable={monProfil} onChange={setProfil} />
        <div className="text-center sm:text-left">
          <h1 className="text-3xl sm:text-4xl font-black uppercase italic tracking-tighter">
            {profil.prenom} <span className="text-primary-orange">{profil.nom}</span>
          </h1>
          {profil.compte_verifie && (
            <span
              className="inline-block mt-1 text-[10px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 px-2 py-1 rounded-full"
              title="Le joueur a relié son compte à cette fiche"
            >
              ✓ Compte vérifié
            </span>
          )}
          <p className="text-sm text-gray-400 mt-1">
            {carriere.tournois} tournoi{carriere.tournois > 1 ? "s" : ""} · {carriere.matchs} match
            {carriere.matchs > 1 ? "s" : ""} joué{carriere.matchs > 1 ? "s" : ""}
          </p>
          {(carriere.titres > 0 || carriere.mvp > 0) && (
            <p className="mt-2 font-bold">
              {carriere.titres > 0 && <span className="mr-4">🏆 {carriere.titres} titre{carriere.titres > 1 ? "s" : ""}</span>}
              {carriere.mvp > 0 && <span>⭐ {carriere.mvp} fois MVP</span>}
            </p>
          )}
        </div>
      </header>

      <section>
        <h2 className="text-lg font-black uppercase mb-3">Moyennes par match</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {STATS.map(({ cle, label }) => (
            <Chiffre key={cle} valeur={carriere.moyennes[cle]} label={label} />
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Totaux : {STATS.map(({ cle, label }) => `${carriere[cle]} ${label.toLowerCase()}`).join(" · ")}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-black uppercase mb-3">Tournois</h2>
        {profil.tournois.length === 0 && <p className="text-gray-400">Aucun tournoi pour le moment.</p>}
        <div className="space-y-3">
          {profil.tournois.map((t) => (
            <article key={`${t.tournoi_slug}-${t.numero}`} className="glass-card p-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                <div>
                  <Link to={`/tournoi/${t.tournoi_slug}`} className="font-black uppercase hover:text-primary-orange">
                    {t.tournoi_nom}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {new Date(t.date_debut).toLocaleDateString("fr-FR", { dateStyle: "long" })} · {t.equipe_nom} · #
                    {t.numero}
                    {t.mvp > 0 && ` · ⭐ MVP ×${t.mvp}`}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${COULEURS_RESULTAT[t.resultat.code]}`}>
                  {t.resultat.code === "champion" && "🏆 "}
                  {t.resultat.libelle}
                </span>
              </div>
              {t.matchs > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-sm">
                  <div>
                    <p className="font-black">{t.matchs}</p>
                    <p className="text-[10px] text-gray-400 uppercase">Matchs</p>
                  </div>
                  {STATS.map(({ cle, label }) => (
                    <div key={cle}>
                      <p className="font-black">{t.moyennes[cle]}</p>
                      <p className="text-[10px] text-gray-400 uppercase">{label} / m</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-500">Aucun match joué dans ce tournoi.</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
