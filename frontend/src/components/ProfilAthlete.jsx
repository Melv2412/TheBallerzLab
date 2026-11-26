import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  changerNumeroAthlete,
  changerPostesAthlete,
  envoyerPhotoAthlete,
  getAthlete,
  getImageUrl,
  messageErreur,
  supprimerPhotoAthlete,
} from "../api";
import { useAuth } from "../AuthContext";
import { compresserImage } from "../images";
import { POSTES, libellePostes } from "../postes";
import { ImageSecours } from "./ImageSecours";
import { IconeJoueur } from "./Icones";

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
        <ImageSecours src={profil.photo} alt={`${profil.prenom} ${profil.nom}`} secours={<span className="text-4xl text-gray-500"><IconeJoueur /></span>} />
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

// Postes du joueur (un ou plusieurs) : affichés partout, modifiables par le joueur relié
function Postes({ profil, modifiable, onChange }) {
  const [edition, setEdition] = useState(false);
  const [choix, setChoix] = useState(profil.postes || []);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");
  const libelle = libellePostes(profil.postes);

  const basculer = (code) => setChoix((actuels) => (actuels.includes(code) ? actuels.filter((c) => c !== code) : [...actuels, code]));

  const enregistrer = async () => {
    setEnvoi(true);
    setErreur("");
    try {
      const { data } = await changerPostesAthlete(profil.id, choix);
      onChange(data);
      setEdition(false);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible d'enregistrer les postes."));
    } finally {
      setEnvoi(false);
    }
  };

  if (!edition) {
    if (!libelle && !modifiable) return null;
    return (
      <p className="text-sm text-gray-300 mt-1">
        {libelle && <span>Poste : {libelle}</span>}
        {modifiable && (
          <button
            type="button"
            onClick={() => {
              setChoix(profil.postes || []);
              setEdition(true);
            }}
            className={`${libelle ? "ml-3" : ""} text-[10px] font-black uppercase tracking-widest text-primary-orange hover:underline`}
          >
            {libelle ? "Changer" : "Choisir mes postes"}
          </button>
        )}
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-xs text-gray-400 mb-2">Un ou plusieurs postes, valables dans tous tes tournois</p>
      <div className="flex flex-wrap gap-2">
        {POSTES.map(({ code, label }) => (
          <button
            key={code}
            type="button"
            aria-pressed={choix.includes(code)}
            onClick={() => basculer(code)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              choix.includes(code) ? "bg-primary-orange border-primary-orange text-white" : "border-white/15 text-gray-300 hover:border-white/40"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-3 text-[10px] font-black uppercase tracking-widest">
        <button type="button" onClick={enregistrer} disabled={envoi} className="text-primary-orange hover:underline disabled:opacity-50">
          {envoi ? "Enregistrement…" : "Enregistrer"}
        </button>
        <button type="button" onClick={() => setEdition(false)} disabled={envoi} className="text-gray-500 hover:text-white">
          Annuler
        </button>
      </div>
      {erreur && <p className="text-xs text-red-400 mt-2">{erreur}</p>}
    </div>
  );
}

// Numéro du joueur dans l'équipe de ce tournoi : il le change lui-même s'il est libre dans l'effectif
function Numero({ profil, tournoi, modifiable, onChange }) {
  const [edition, setEdition] = useState(false);
  const [valeur, setValeur] = useState(String(tournoi.numero));
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  const enregistrer = async (e) => {
    e.preventDefault();
    const numero = Number.parseInt(valeur, 10);
    if (Number.isNaN(numero) || numero < 0 || numero > 99) {
      setErreur("Le numéro doit être entre 0 et 99.");
      return;
    }
    setEnvoi(true);
    setErreur("");
    try {
      const { data } = await changerNumeroAthlete(profil.id, tournoi.joueur_id, numero);
      onChange(data);
      setEdition(false);
    } catch (error) {
      setErreur(messageErreur(error, "Impossible de changer le numéro."));
    } finally {
      setEnvoi(false);
    }
  };

  if (!edition) {
    return (
      <>
        #{tournoi.numero}
        {modifiable && tournoi.numero_modifiable && (
          <button
            type="button"
            onClick={() => {
              setValeur(String(tournoi.numero));
              setErreur("");
              setEdition(true);
            }}
            className="ml-2 text-[10px] font-black uppercase tracking-widest text-primary-orange hover:underline"
          >
            Changer
          </button>
        )}
      </>
    );
  }

  return (
    <form onSubmit={enregistrer} className="inline-flex flex-wrap items-center gap-2 align-middle">
      <label className="sr-only" htmlFor={`numero-${tournoi.joueur_id}`}>
        Nouveau numéro
      </label>
      <input
        id={`numero-${tournoi.joueur_id}`}
        type="number"
        min="0"
        max="99"
        inputMode="numeric"
        value={valeur}
        onChange={(e) => setValeur(e.target.value)}
        className="w-16 bg-white/5 border border-white/15 rounded-lg px-2 py-1 text-white text-sm"
        autoFocus
      />
      <button type="submit" disabled={envoi} className="text-[10px] font-black uppercase tracking-widest text-primary-orange hover:underline disabled:opacity-50">
        {envoi ? "…" : "OK"}
      </button>
      <button type="button" onClick={() => setEdition(false)} disabled={envoi} className="text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white">
        Annuler
      </button>
      {erreur && <span className="basis-full text-xs text-red-400">{erreur}</span>}
    </form>
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
          <Postes key={profil.postes?.join()} profil={profil} modifiable={monProfil} onChange={setProfil} />
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
            <article key={t.joueur_id} className="glass-card p-4">
              <div className="flex flex-wrap justify-between items-start gap-2 mb-3">
                <div>
                  <Link to={`/tournoi/${t.tournoi_slug}`} className="font-black uppercase hover:text-primary-orange">
                    {t.tournoi_nom}
                  </Link>
                  <p className="text-xs text-gray-400">
                    {new Date(t.date_debut).toLocaleDateString("fr-FR", { dateStyle: "long" })} · {t.equipe_nom} ·{" "}
                    <Numero profil={profil} tournoi={t} modifiable={monProfil} onChange={setProfil} />
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
