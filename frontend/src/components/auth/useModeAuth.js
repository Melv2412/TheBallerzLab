import { useLocation, useNavigate } from "react-router-dom";
import { cheminSuite } from "../invitation/invitation";
import { THEMES, lienAuth, modeAuth } from "./mode";

// Mode (organisateur ou joueur), thème de couleurs et retour à l'invitation, lus dans l'URL
export function useModeAuth(page) {
  const { search } = useLocation();
  const navigate = useNavigate();
  const mode = modeAuth(search);
  const suite = cheminSuite(search);
  return {
    mode,
    suite,
    theme: THEMES[mode],
    changerMode: (nouveau) => navigate(lienAuth(page, nouveau, suite), { replace: true }),
    lien: (autrePage) => lienAuth(autrePage, mode, suite),
  };
}
