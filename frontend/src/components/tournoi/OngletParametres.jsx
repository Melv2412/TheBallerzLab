import React, { useState, useEffect } from "react";
import { updateTournoi, resetPlayoffs, messageErreur } from "../../api";
import { FormulaireReglement } from "../reglement/FormulaireReglement";
import { usePresets } from "../reglement/presets";
import { PHASES, erreurPhases, phasesCommencees, pointsVerrouilles } from "./phases";
import { useRetours } from "../retours/contexte";
import { ReglageCarte } from "./ReglageCarte";

const formulaireDepuis = (tournoi) => ({
  has_8emes: tournoi.has_8emes,
  has_quarts: tournoi.has_quarts,
  has_demis: tournoi.has_demis,
  has_finale: tournoi.has_finale,
  reglement: tournoi.reglement,
  victoires_requises_8eme: tournoi.victoires_requises_8eme || 1,
  victoires_requises_quart: tournoi.victoires_requises_quart || 1,
  victoires_requises_demi: tournoi.victoires_requises_demi || 1,
  victoires_requises_finale: tournoi.victoires_requises_finale || 1,
});

export function OngletParametres({ tournoi, matchs, recharger }) {
  const [form, setForm] = useState(() => formulaireDepuis(tournoi));
  const [enregistrement, setEnregistrement] = useState(false);
  const presets = usePresets();
  const retours = useRetours();
  const commencees = phasesCommencees(matchs);
  const structureVerrouillee = commencees.size > 0;
  const pointsBloques = pointsVerrouilles(matchs);

  useEffect(() => {
    setForm(formulaireDepuis(tournoi));
  }, [tournoi]);

  // Tant qu'aucune phase n'a commencé, changer la structure efface seulement les matchs prévus
  const reinitialiserSiBesoin = async () => {
    if (!PHASES.some((p) => form[p.cle] !== tournoi[p.cle])) return true;
    const ok = await retours.confirmer({
      titre: "Changer les phases finales ?",
      message: "Modifier la structure des phases finales supprimera les matchs éliminatoires prévus.",
      libelleOk: "Continuer",
      danger: true,
    });
    if (!ok) return false;
    try {
      await resetPlayoffs(tournoi.slug);
    } catch (err) {
      console.error("Erreur lors de la réinitialisation des playoffs:", err);
      retours.erreur(messageErreur(err, "Erreur lors de la réinitialisation des playoffs"));
      return false;
    }
    return true;
  };

  // Les boutons de règlement de base ne doivent pas changer des points verrouillés
  const changerReglement = (reglement) => {
    const { points_victoire, points_defaite } = tournoi.reglement;
    setForm({ ...form, reglement: pointsBloques ? { ...reglement, points_victoire, points_defaite } : reglement });
  };

  const enregistrer = async (e) => {
    e.preventDefault();
    // Vérifié avant la réinitialisation : un refus du serveur ne doit pas effacer les playoffs pour rien
    const erreur = erreurPhases(form);
    if (erreur) {
      retours.erreur(erreur);
      return;
    }
    if (!(await reinitialiserSiBesoin())) return;

    setEnregistrement(true);
    try {
      await updateTournoi(tournoi.slug, form);
      retours.succes("Paramètres enregistrés.");
      recharger();
    } catch (err) {
      console.error("Erreur lors de la mise à jour du tournoi:", err);
      retours.erreur(messageErreur(err, "Erreur lors de l'enregistrement des paramètres"));
    } finally {
      setEnregistrement(false);
    }
  };

  return (
    <div className="animate-fade-in max-w-3xl mx-auto glass-card p-5 sm:p-10 border border-white/5 relative">
      <h2 className="text-2xl sm:text-4xl font-black italic mb-8 card-title-accent uppercase">Paramètres du Tournoi</h2>
      <div className="mb-8">
        <ReglageCarte tournoi={tournoi} recharger={recharger} />
      </div>
      <form onSubmit={enregistrer} className="space-y-8">
        <div className="border-b border-white/5 pb-6">
          <h3 className="text-lg font-black uppercase text-primary-orange mb-2 tracking-wider">Règlement</h3>
          <p className="text-xs text-gray-500 mb-6 italic">
            * S'applique aux matchs à venir. Les matchs en cours ou terminés gardent leur règlement, et chaque match
            peut être ajusté depuis son tableau de marque.
            {pointsBloques && " Un match est terminé : les points au classement ne peuvent plus changer."}
          </p>
          <FormulaireReglement
            reglement={form.reglement}
            donnees={presets}
            verrouilles={pointsBloques ? ["points_victoire", "points_defaite"] : []}
            onChange={changerReglement}
          />
        </div>

        <div className="border-b border-white/5 pb-6">
          <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">Phases Finales Actives</h3>
          <p className="text-xs text-gray-500 mb-6 italic">
            {structureVerrouillee
              ? "* Les phases finales ont commencé : pour changer leur format, utilisez « Réinitialiser les Playoffs » dans l'onglet Phase Finale."
              : "* Note : modifier la structure supprimera les matchs éliminatoires prévus."}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {PHASES.map((phase) => (
              <label
                key={phase.cle}
                className={`flex flex-col items-center gap-3 bg-white/5 border border-white/10 p-5 rounded-2xl transition-all select-none ${structureVerrouillee ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:bg-white/10 hover:border-primary-orange/50"}`}
              >
                <input
                  type="checkbox"
                  checked={form[phase.cle]}
                  disabled={structureVerrouillee}
                  onChange={(e) => setForm({ ...form, [phase.cle]: e.target.checked })}
                  className="accent-primary-orange w-5 h-5"
                />
                <span className="text-xs font-black uppercase tracking-wider text-white">{phase.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-lg font-black uppercase text-primary-orange mb-4 tracking-wider">
            Format des Séries (Nombre de Victoires)
          </h3>
          <p className="text-xs text-gray-500 mb-6 italic">
            * Définissez le nombre de victoires requises pour remporter une série à chaque étape (ex: 1 pour match unique, 2
            pour un Best-of-3, 3 pour un Best-of-5).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {PHASES.filter((p) => form[p.cle]).map((phase) => (
              <div key={phase.victoires}>
                <label className="block text-xs font-black text-gray-400 mb-2 uppercase tracking-widest">
                  Victoires requises en {phase.labelVictoires}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  disabled={commencees.has(phase.phase)}
                  value={form[phase.victoires]}
                  onChange={(e) => setForm({ ...form, [phase.victoires]: parseInt(e.target.value) || 1 })}
                  className="w-full px-5 py-4 glass-input rounded-2xl focus:outline-none disabled:opacity-40"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-4 flex gap-4">
          <button type="submit" disabled={enregistrement} className="btn-basketball flex-1 py-5 text-sm disabled:opacity-50">
            Sauvegarder les Paramètres
          </button>
        </div>
      </form>
    </div>
  );
}
