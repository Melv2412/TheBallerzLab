import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadOswald } from '@remotion/google-fonts/Oswald';
import { loadFont as loadOrbitron } from '@remotion/google-fonts/Orbitron';

// Mêmes polices que l'application (frontend/src/index.css)
const inter = loadInter('normal', { weights: ['400', '700', '900'], subsets: ['latin'] });
loadInter('italic', { weights: ['900'], subsets: ['latin'] });
const oswald = loadOswald('normal', { weights: ['600', '700'], subsets: ['latin'] });
const orbitron = loadOrbitron('normal', { weights: ['700', '900'], subsets: ['latin'] });

export const polices = {
  texte: inter.fontFamily,
  titre: oswald.fontFamily,
  digital: orbitron.fontFamily,
};

// Couleurs de l'application
export const couleurs = {
  orange: '#ff6b00',
  violet: '#8B5CF6',
  jaune: '#FFD700',
  noir: '#111111',
  blanc: '#ffffff',
  gris: '#9ca3af',
  verre: 'rgba(20, 20, 20, 0.72)',
  bordure: 'rgba(255, 107, 0, 0.25)',
};

export const FPS = 30;
// Silence avant et après la voix dans chaque scène (en images)
export const MARGE_AVANT = 12;
export const MARGE_APRES = 22;
