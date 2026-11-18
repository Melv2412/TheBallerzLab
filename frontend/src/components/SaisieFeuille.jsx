import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getJoueurs, getMatch, messageErreur, saisieFeuille } from "../api";
import { useAuth } from "../AuthContext";
import { peutModifier } from "../permissions";
import { enTetePeriode } from "./feuille/feuille";
import { CHAMPS, donneesAEnvoyer, erreurSaisie, lignesInitiales, periodesInitiales, totalEquipe } from "./feuille/saisie";
import { ModalPresences } from "./match-live/ModalPresences";

// Feuille de match remplie après coup (match joué sans tableau de marque en direct)
export default function SaisieFeuille() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [match, setMatch] = useState(null);
  const [lignes, setLignes] = useState([]);
  const [periodes, setPeriodes] = useState({ domicile: [], exterieur: [] });
  const [terminer, setTerminer] = useState(true);
  const [erreur, setErreur] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [presences, setPresences] = useState(false);

  useEffect(() => {
    getMatch(id)
      .then(async ({ data }) => {
        const [dom, ext] = await Promise.all([getJoueurs(data.equipe_domicile), getJoueurs(data.equipe_exterieur)]);
        setMatch(data);
        setLignes(lignesInitiales([...dom.data, ...ext.data], data.statistiques));
        setPeriodes(periodesInitiales(data));
      })
      .catch((e) => setErreur(messageErreur(e, "Match introuvable.")));
  }, [id]);

  if (presences) {
    return <ModalPresences matchId={id} automatique onFermer={() => navigate(`/match/${id}/feuille`)} />;
  }
  if (!match) return <div className="text-center py-10 animate-pulse">{erreur || "Chargement..."}</div>;
  if (!peutModifier(user, match.organisateur_id)) {
    return <div className="text-center py-10">Seul l'organisateur du tournoi peut saisir la feuille.</div>;
  }
  if (match.tournoi_cloture_le) {
    return <div className="text-center py-10">Ce tournoi est clôturé : la feuille ne peut plus être saisie.</div>;
  }
  if (match.statut === "termine") {
    return (
      <div className="text-center py-10">
        Ce match est terminé.{" "}
        <Link to={`/match/${id}/feuille`} className="text-primary-orange font-bold">Voir la feuille</Link>
      </div>
    );
  }

  const nbPeriodes = match.reglement.nb_periodes;
  const changerLigne = (joueur, cle, valeur) =>
    setLignes((l) => l.map((ligne) => (ligne.joueur === joueur ? { ...ligne, [cle]: valeur } : ligne)));
  const changerPeriode = (cote, index, valeur) =>
    setPeriodes((p) => ({ ...p, [cote]: p[cote].map((v, i) => (i === index ? valeur : v)) }));
  const modifierProlongations = (delta) =>
    setPeriodes((p) => ({
      domicile: delta > 0 ? [...p.domicile, ""] : p.domicile.slice(0, -1),
      exterieur: delta > 0 ? [...p.exterieur, ""] : p.exterieur.slice(0, -1),
    }));

  const enregistrer = async (e) => {
    e.preventDefault();
    const probleme = erreurSaisie(match, lignes, periodes, terminer);
    if (probleme) return setErreur(probleme);
    setErreur("");
    setEnvoi(true);
    try {
      await saisieFeuille(id, donneesAEnvoyer(lignes, periodes, terminer));
      if (terminer) setPresences(true);
      else navigate(`/match/${id}/feuille`);
    } catch (err) {
      setErreur(messageErreur(err, "La feuille n'a pas pu être enregistrée."));
      setEnvoi(false);
    }
  };

  const equipes = [
    { id: match.equipe_domicile, nom: match.equipe_domicile_nom, cote: "domicile" },
    { id: match.equipe_exterieur, nom: match.equipe_exterieur_nom, cote: "exterieur" },
  ];
  const champNombre = "glass-input w-14 px-1 py-1 text-center";

  return (
    <form onSubmit={enregistrer} className="max-w-4xl mx-auto space-y-6">
      <Link to={`/match/${id}`} className="text-gray-400 hover:text-white font-bold text-xs uppercase tracking-widest">
        ← Retour au match
      </Link>
      <h1 className="text-2xl font-black uppercase">
        Saisir la feuille : {match.equipe_domicile_nom} – {match.equipe_exterieur_nom}
      </h1>
      <p className="text-sm text-gray-400">
        Remplis les totaux de chaque joueur. Le score du match est la somme de leurs points. Cette saisie remplace les
        stats déjà enregistrées.
      </p>

      {equipes.map((equipe) => (
        <section key={equipe.id} className="glass-card p-4 overflow-x-auto">
          <h2 className="text-lg font-black uppercase mb-3">
            {equipe.nom} · <span className="text-primary-orange">{totalEquipe(lignes, equipe.id)} pts</span>
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 text-xs uppercase">
                <th className="text-left py-1">Joueur</th>
                {CHAMPS.map(({ cle, label }) => (
                  <th key={cle} className="px-1">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignes
                .filter((l) => l.equipe === equipe.id)
                .map((ligne) => (
                  <tr key={ligne.joueur}>
                    <td className="py-1 pr-2 whitespace-nowrap">{ligne.libelle}</td>
                    {CHAMPS.map(({ cle, label }) => (
                      <td key={cle} className="px-1 text-center">
                        <input
                          type="number"
                          min="0"
                          max={cle === "fautes" ? match.reglement.fautes_exclusion || 20 : 200}
                          value={ligne[cle]}
                          onChange={(e) => changerLigne(ligne.joueur, cle, e.target.value)}
                          aria-label={`${label} ${ligne.libelle}`}
                          className={champNombre}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
          {lignes.every((l) => l.equipe !== equipe.id) && (
            <p className="text-gray-400 text-sm">Aucun joueur dans cette équipe.</p>
          )}
        </section>
      ))}

      <section className="glass-card p-4 overflow-x-auto">
        <h2 className="text-lg font-black uppercase mb-1">Score par période (facultatif)</h2>
        <p className="text-xs text-gray-400 mb-3">Laisse vide si tu ne l'as pas. Sinon, chaque ligne doit faire le total de l'équipe.</p>
        <table className="text-sm">
          <thead>
            <tr className="text-gray-400 text-xs uppercase">
              <th />
              {periodes.domicile.map((_, i) => (
                <th key={i} className="px-1">{enTetePeriode(i + 1, nbPeriodes)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {equipes.map((equipe) => (
              <tr key={equipe.cote}>
                <td className="pr-3 font-bold whitespace-nowrap">{equipe.nom}</td>
                {periodes[equipe.cote].map((valeur, i) => (
                  <td key={i} className="px-1">
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={valeur}
                      onChange={(e) => changerPeriode(equipe.cote, i, e.target.value)}
                      aria-label={`${equipe.nom} période ${i + 1}`}
                      className={champNombre}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-3 mt-3 text-xs">
          <button type="button" onClick={() => modifierProlongations(1)} className="text-primary-orange font-bold">
            + Prolongation
          </button>
          {periodes.domicile.length > nbPeriodes && (
            <button type="button" onClick={() => modifierProlongations(-1)} className="text-gray-400 font-bold">
              − Retirer la prolongation
            </button>
          )}
        </div>
      </section>

      <label className="flex items-center gap-2 font-bold">
        <input type="checkbox" checked={terminer} onChange={(e) => setTerminer(e.target.checked)} />
        Terminer le match (le résultat compte au classement et pour la suite du tableau)
      </label>

      {erreur && <p className="text-red-400 font-bold">{erreur}</p>}

      <button type="submit" disabled={envoi} className="btn-basketball">
        {envoi ? "Enregistrement..." : "Enregistrer la feuille"}
      </button>
    </form>
  );
}
