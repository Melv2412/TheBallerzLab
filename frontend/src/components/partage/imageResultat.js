// Image carrée 1080×1080 du résultat d'un match (format story / post), aux couleurs de THE LAB

const ORANGE = "#ff6b00"; // couleur de la marque (tailwind primary-orange)

export const vainqueur = (match) => {
  if (match.score_domicile === match.score_exterieur) return null;
  return match.score_domicile > match.score_exterieur ? "domicile" : "exterieur";
};

export const ligneMvp = (mvp) =>
  mvp ? `${mvp.nom} · ${mvp.stats.pts} PTS · ${mvp.stats.reb} REB · ${mvp.stats.ast} AST` : "";

const ajuster = (ctx, texte, largeurMax, taille, graisse = 900) => {
  let t = taille;
  ctx.font = `italic ${graisse} ${t}px system-ui, sans-serif`;
  while (ctx.measureText(texte).width > largeurMax && t > 20) {
    t -= 2;
    ctx.font = `italic ${graisse} ${t}px system-ui, sans-serif`;
  }
};

export const imageResultat = (match) => {
  const cote = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = cote;
  canvas.height = cote;
  const ctx = canvas.getContext("2d");

  const fond = ctx.createLinearGradient(0, 0, cote, cote);
  fond.addColorStop(0, "#0b0b0c");
  fond.addColorStop(1, "#1f1307");
  ctx.fillStyle = fond;
  ctx.fillRect(0, 0, cote, cote);
  ctx.fillStyle = ORANGE;
  ctx.fillRect(0, 0, cote, 14);
  ctx.textAlign = "center";

  ctx.fillStyle = "#9ca3af";
  ajuster(ctx, match.tournoi_nom.toUpperCase(), 900, 40, 800);
  ctx.fillText(match.tournoi_nom.toUpperCase(), cote / 2, 110);

  ctx.fillStyle = "#fff";
  ctx.font = "italic 900 54px system-ui, sans-serif";
  ctx.fillText(match.forfait ? "FORFAIT" : "RÉSULTAT FINAL", cote / 2, 190);

  const gagnant = vainqueur(match);
  const colonnes = [
    { nom: match.equipe_domicile_nom, score: match.score_domicile, x: cote * 0.27, cote: "domicile" },
    { nom: match.equipe_exterieur_nom, score: match.score_exterieur, x: cote * 0.73, cote: "exterieur" },
  ];
  for (const { nom, score, x, cote: c } of colonnes) {
    ctx.fillStyle = gagnant === c ? ORANGE : "#fff";
    ctx.font = "900 220px system-ui, sans-serif";
    ctx.fillText(String(score), x, 520);
    ctx.fillStyle = "#fff";
    ajuster(ctx, nom.toUpperCase(), 440, 56);
    ctx.fillText(nom.toUpperCase(), x, 620);
  }
  ctx.fillStyle = "#4b5563";
  ctx.font = "900 90px system-ui, sans-serif";
  ctx.fillText("–", cote / 2, 490);

  if (match.mvp) {
    ctx.fillStyle = ORANGE;
    ctx.beginPath();
    ctx.roundRect(90, 720, cote - 180, 190, 32);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillText("MVP DU MATCH", cote / 2, 780);
    ctx.fillStyle = "#000";
    const mvp = ligneMvp(match.mvp);
    ajuster(ctx, mvp.toUpperCase(), cote - 240, 52);
    ctx.fillText(mvp.toUpperCase(), cote / 2, 860);
  }

  ctx.font = "italic 900 44px system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "right";
  ctx.fillText("THE ", cote / 2 + 10, 1020);
  ctx.fillStyle = ORANGE;
  ctx.textAlign = "left";
  ctx.fillText("LAB", cote / 2 + 10, 1020);

  return new Promise((resoudre) => canvas.toBlob(resoudre, "image/png"));
};
