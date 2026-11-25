import React from "react";
import { NOMS_PRESETS, typeReglement } from "./presets";

const RESETS = [
  { valeur: "periode", label: "Chaque période" },
  { valeur: "mi_temps", label: "Chaque mi-temps" },
  { valeur: "match", label: "Jamais (tout le match)" },
];

const MODES_CLASSEMENT = [
  { valeur: "points", label: "Aux points (FIBA)" },
  { valeur: "pourcentage", label: "Au % de victoires" },
];

const champ = "w-full px-4 py-3 glass-input rounded-xl focus:outline-none disabled:opacity-40";
const etiquette = "block text-[10px] font-black text-gray-400 mb-2 uppercase tracking-widest";

function Groupe({ titre, children }) {
  return (
    <div className="border-b border-white/5 pb-5">
      <h4 className="text-sm font-black uppercase text-primary-orange mb-4 tracking-wider">{titre}</h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{children}</div>
    </div>
  );
}

/**
 * Formulaire du règlement (tournoi ou match).
 * - `modifiables` : liste des réglages éditables (les autres sont grisés) ; tout est éditable si absent.
 * - `verrouilles` : réglages grisés quoi qu'il arrive.
 * - `avecClassement` : affiche le mode et les points de classement (propres au tournoi).
 */
export function FormulaireReglement({ reglement, onChange, donnees, modifiables, verrouilles = [], avecClassement = true }) {
  if (!reglement || !donnees) return <div className="text-gray-500 italic text-sm">Chargement du règlement...</div>;

  const { presets, bornes } = donnees;
  const type = typeReglement(reglement, presets);
  const libre = (cle) => (!modifiables || modifiables.includes(cle)) && !verrouilles.includes(cle);
  const changer = (cle, valeur) => onChange({ ...reglement, [cle]: valeur });

  const nombre = (cle, label, aide) => {
    const [min, max] = bornes[cle];
    return (
      <div key={cle}>
        <label className={etiquette}>{label}</label>
        <input
          type="number"
          min={min}
          max={max}
          required
          disabled={!libre(cle)}
          value={reglement[cle]}
          onChange={(e) => {
            const valeur = parseInt(e.target.value);
            if (!Number.isNaN(valeur)) changer(cle, valeur);
          }}
          className={champ}
        />
        {aide && <p className="text-[10px] text-gray-600 mt-1">{aide}</p>}
      </div>
    );
  };

  // Durées saisies en minutes, enregistrées en secondes
  const minutes = (cle, label) => {
    const [min, max] = bornes[cle];
    return (
      <div key={cle}>
        <label className={etiquette}>{label}</label>
        <input
          type="number"
          min={min / 60}
          max={max / 60}
          step="0.5"
          required
          disabled={!libre(cle)}
          value={reglement[cle] / 60}
          onChange={(e) => {
            const valeur = parseFloat(e.target.value);
            if (!Number.isNaN(valeur)) changer(cle, Math.round(valeur * 60));
          }}
          className={champ}
        />
      </div>
    );
  };

  const presetsChoisissables = !modifiables;

  return (
    <div className="space-y-5">
      <div>
        <label className={etiquette}>Règlement de base</label>
        <div className="flex flex-wrap gap-2">
          {Object.keys(presets).map((nom) => (
            <button
              key={nom}
              type="button"
              disabled={!presetsChoisissables}
              onClick={() => onChange({ ...presets[nom] })}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all disabled:cursor-default ${type === nom ? "bg-primary-orange text-white" : "bg-white/5 text-gray-400 hover:text-white"}`}
            >
              {NOMS_PRESETS[nom]}
            </button>
          ))}
          <span
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest ${type === "personnalise" ? "bg-primary-orange text-white" : "bg-white/5 text-gray-600"}`}
          >
            {NOMS_PRESETS.personnalise}
          </span>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          Choisissez une base, puis modifiez ce que vous voulez : le règlement devient « Personnalisé ».
          {reglement.nb_periodes === 1 && " En 3x3 officiel, la prolongation se joue au premier à 2 points : ici, elle est chronométrée."}
        </p>
      </div>

      <Groupe titre="Périodes">
        {nombre("nb_periodes", "Nombre de périodes")}
        {minutes("duree_periode_secondes", "Durée d'une période (min)")}
        {minutes("duree_prolongation_secondes", "Durée d'une prolongation (min)")}
      </Groupe>

      <Groupe titre="Shot clock">
        <label className="flex items-center gap-3 sm:col-span-3 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={!libre("shot_clock_actif")}
            checked={reglement.shot_clock_actif}
            onChange={(e) => changer("shot_clock_actif", e.target.checked)}
            className="accent-primary-orange w-5 h-5"
          />
          <span className="text-xs font-black uppercase tracking-wider text-white">Shot clock activé</span>
        </label>
        {reglement.shot_clock_actif && (
          <>
            {nombre("shot_clock_secondes", "Durée (s)")}
            {nombre("shot_clock_court_secondes", "Remise courte (s)", "Ex. 14 s après un rebond offensif")}
          </>
        )}
      </Groupe>

      <Groupe titre="Fautes">
        {nombre("fautes_exclusion", "Exclusion d'un joueur à", "0 = jamais exclu")}
        {nombre("fautes_bonus", "Lancers francs à partir de la", "Xe faute d'équipe")}
        <div>
          <label className={etiquette}>Fautes d'équipe remises à zéro</label>
          <select
            disabled={!libre("fautes_equipe_reset")}
            value={reglement.fautes_equipe_reset}
            onChange={(e) => changer("fautes_equipe_reset", e.target.value)}
            className={`${champ} appearance-none`}
          >
            {RESETS.map((r) => (
              <option key={r.valeur} value={r.valeur} className="bg-black">
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </Groupe>

      <Groupe titre="Temps morts par équipe">
        {nombre("temps_morts_premiere_mi_temps", "1re mi-temps")}
        {nombre("temps_morts_seconde_mi_temps", "2e mi-temps")}
        {nombre("temps_morts_prolongation", "Par prolongation")}
      </Groupe>

      {avecClassement && (
        <Groupe titre="Classement">
          <div>
            <label className={etiquette}>Ordre du classement</label>
            <select
              disabled={!libre("mode_classement")}
              value={reglement.mode_classement || "points"}
              onChange={(e) => changer("mode_classement", e.target.value)}
              className={`${champ} appearance-none`}
            >
              {MODES_CLASSEMENT.map((m) => (
                <option key={m.valeur} value={m.valeur} className="bg-black">
                  {m.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-600 mt-1">
              {reglement.mode_classement === "pourcentage"
                ? "Égalité : différence de points, puis points marqués"
                : "Égalité : matchs entre elles, puis différence de points"}
            </p>
          </div>
          {reglement.mode_classement !== "pourcentage" && (
            <>
              {nombre("points_victoire", "Points par victoire")}
              {nombre("points_defaite", "Points par défaite")}
            </>
          )}
        </Groupe>
      )}
    </div>
  );
}
