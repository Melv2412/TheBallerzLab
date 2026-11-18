import axios from 'axios'

// En dev, le proxy Vite redirige /api et /media vers Django (voir vite.config.js)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
const MEDIA_BASE_URL = import.meta.env.VITE_MEDIA_URL || ''

export const getImageUrl = (path) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  return `${MEDIA_BASE_URL}${path}`
}

const api = axios.create({
  baseURL: API_BASE_URL,
})

// Un seul rafraîchissement à la fois, partagé par les requêtes en attente
let refreshEnCours = null

// Le token d'accès expire-t-il dans moins de 30 s ? (date lue dans le JWT, sans vérifier la signature)
export const tokenExpire = (token, maintenant = Date.now()) => {
  try {
    const { exp } = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    return typeof exp !== 'number' || exp * 1000 - maintenant < 30000
  } catch {
    return true
  }
}

// Intercepteur pour injecter le token JWT : un token expiré est renouvelé avant l'envoi
// (sinon chaque requête d'une page rechargée échoue d'abord en 401)
api.interceptors.request.use(
  async (config) => {
    let token = localStorage.getItem('token')
    if (token && tokenExpire(token) && localStorage.getItem('refresh') && !config.url?.startsWith('/token/')) {
      token = await rafraichirToken().catch(() => token) // échec : le 401 habituel déconnectera
    }
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

const rafraichirToken = () => {
  if (!refreshEnCours) {
    const refresh = localStorage.getItem('refresh')
    refreshEnCours = (refresh
      ? axios.post(`${API_BASE_URL}/token/refresh/`, { refresh })
      : Promise.reject(new Error('Pas de refresh token'))
    )
      .then((response) => {
        localStorage.setItem('token', response.data.access)
        // Rotation : l'ancien refresh token est révoqué, on garde le nouveau
        if (response.data.refresh) localStorage.setItem('refresh', response.data.refresh)
        return response.data.access
      })
      .finally(() => {
        refreshEnCours = null
      })
  }
  return refreshEnCours
}

// Intercepteur pour gérer les erreurs : sur un 401, on rafraîchit le token puis on rejoue la requête
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const requete = error.config
    const estRequeteToken = requete?.url?.startsWith('/token/')

    if (error.response?.status === 401 && requete && !requete._retry && !estRequeteToken) {
      requete._retry = true
      try {
        const access = await rafraichirToken()
        requete.headers.Authorization = `Bearer ${access}`
        return api(requete)
      } catch {
        // Session expirée : on déconnecte (AuthContext écoute cet événement)
        localStorage.removeItem('token')
        localStorage.removeItem('refresh')
        localStorage.removeItem('user')
        window.dispatchEvent(new Event('auth:logout'))
      }
    }
    console.error('Erreur API:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Auth
export const login = (credentials) => api.post('/token/', credentials)
export const register = (userData) => api.post('/users/', userData)
export const getMe = () => api.get('/users/me/')
export const devenirOrganisateur = () => api.post('/users/devenir_organisateur/')
// Révoque le refresh token côté serveur (best effort : la déconnexion locale a lieu quoi qu'il arrive)
export const revoquerSession = (refresh) => axios.post(`${API_BASE_URL}/token/blacklist/`, { refresh })

// Premier message d'erreur renvoyé par l'API (ex. « Un tournoi ne peut pas dépasser 32 équipes. »)
export const messageErreur = (error, defaut = 'Une erreur est survenue.') => {
  const data = error?.response?.data
  if (!data) return defaut
  if (typeof data === 'string') return defaut
  if (data.detail) return String(data.detail)
  const premier = Object.values(data).flat()[0]
  return typeof premier === 'string' ? premier : defaut
}

// Tournois (liste paginée : 50 par page, `next` indique s'il en reste)
export const getTournois = (search = '', page = 1) =>
  api.get('/tournois/', { params: { ...(search ? { search } : {}), page } })
export const getTournoi = (slug) => api.get(`/tournois/${slug}/`)
export const createTournoi = (data) => api.post('/tournois/', data)
export const updateTournoi = (slug, data) => api.patch(`/tournois/${slug}/`, data)
export const deleteTournoi = (slug) => api.delete(`/tournois/${slug}/`)
export const getClassement = (idOrSlug, type = '') => {
  const url = type ? `/tournois/${idOrSlug}/classement/?type=${type}` : `/tournois/${idOrSlug}/classement/`
  return api.get(url)
}
export const getTournamentMVP = (idOrSlug, type = '') => {
  const url = type ? `/tournois/${idOrSlug}/mvp/?type=${type}` : `/tournois/${idOrSlug}/mvp/`
  return api.get(url)
}

// Charge toutes les pages d'une liste paginée et renvoie { data: [...] }.
// Avec 500 éléments par page, les équipes, joueurs ou matchs d'un tournoi tiennent presque toujours en une requête.
const toutesLesPages = async (url, params = {}) => {
  const resultats = []
  for (let page = 1; ; page++) {
    const { data } = await api.get(url, { params: { ...params, page, page_size: 500 } })
    resultats.push(...(data.results || []))
    if (!data.next) return { data: resultats }
  }
}

// Équipes
export const getEquipes = (tournoiId = null) =>
  toutesLesPages('/equipes/', tournoiId ? { tournoi: tournoiId } : {})
export const createEquipe = (data) => api.post('/equipes/', data)
export const updateEquipe = (id, data) => api.patch(`/equipes/${id}/`, data)
export const deleteEquipe = (id) => api.delete(`/equipes/${id}/`)

// Joueurs
export const getJoueurs = (equipeId = null) =>
  toutesLesPages('/joueurs/', equipeId ? { equipe: equipeId } : {})
export const getJoueursTournoi = (tournoi) => toutesLesPages('/joueurs/', { tournoi })
export const createJoueur = (data) => api.post('/joueurs/', data)
export const updateJoueur = (id, data) => api.patch(`/joueurs/${id}/`, data)
export const deleteJoueur = (id) => api.delete(`/joueurs/${id}/`)
export const retirerJoueur = (id) => api.post(`/joueurs/${id}/retirer/`)
export const reintegrerJoueur = (id) => api.post(`/joueurs/${id}/reintegrer/`)
// Profil public d'un athlète : carrière, tournois joués, palmarès
export const getAthlete = (id) => api.get(`/athletes/${id}/`)
export const envoyerPhotoAthlete = (id, fichier) => {
  const donnees = new FormData()
  donnees.append('photo', fichier)
  return api.post(`/athletes/${id}/photo/`, donnees)
}
export const supprimerPhotoAthlete = (id) => api.delete(`/athletes/${id}/photo/`)
// Fiche athlète existante (email exact) : { athlete, prenom, nom, nb_tournois }, ou 404
export const rechercherAthlete = (email) => api.get('/joueurs/recherche_athlete/', { params: { email } })

// Matchs
export const getMatchs = (tournoiId = null, statut = null) =>
  toutesLesPages('/matchs/', {
    ...(tournoiId ? { tournoi: tournoiId } : {}),
    ...(statut ? { statut } : {}),
  })
export const getMatch = (id) => api.get(`/matchs/${id}/`)
export const createMatch = (data) => api.post('/matchs/', data)
export const updateMatch = (id, data) => api.patch(`/matchs/${id}/`, data)
export const deleteMatch = (id) => api.delete(`/matchs/${id}/`)
// Feuille saisie après coup : totaux de chaque joueur, score par période, fin du match
export const saisieFeuille = (id, data) => api.post(`/matchs/${id}/saisie_feuille/`, data)
// Joueurs sans stat d'un match terminé : liste, et confirmation de ceux qui ont joué
export const getPresences = (id) => api.get(`/matchs/${id}/presences/`)
export const enregistrerPresences = (id, presents) => api.post(`/matchs/${id}/presences/`, { presents })
export const initialiserStatsMatch = (id) => api.post(`/matchs/${id}/initialiser_stats/`)
export const tempsMort = (id, equipe) => api.post(`/matchs/${id}/temps_mort/`, { equipe })
export const periodeSuivante = (id) => api.post(`/matchs/${id}/periode_suivante/`)
// Historique du match et annulation de la dernière action (stat ou temps mort)
export const getActions = (id) => api.get(`/matchs/${id}/actions/`)
export const annulerDerniereAction = (id) => api.post(`/matchs/${id}/annuler_derniere_action/`)

// Préréglages du règlement (FIBA, NBA, 3x3) : chargés une seule fois
let presetsEnCache = null
export const getReglements = () => {
  presetsEnCache = presetsEnCache || api.get('/reglements/').then((r) => r.data).catch((e) => {
    presetsEnCache = null
    throw e
  })
  return presetsEnCache
}

// Statistiques
export const updateStatistique = (matchId, statId, champ, action, valeur = 1) => {
  return api.patch(`/matchs/${matchId}/stats/${statId}/update/`, {
    champ,
    action,
    valeur
  })
}

// Reset Playoffs
export const resetPlayoffs = (slug, phase = '') => api.post(`/tournois/${slug}/reset_playoffs/`, { phase })
// Phases finales : état des séries, et création du premier tour d'après le classement de poule
export const getPhasesFinales = (slug) => api.get(`/tournois/${slug}/phases_finales/`)
export const genererPhasesFinales = (slug) => api.post(`/tournois/${slug}/generer_phases_finales/`)




// Lien d'invitation d'équipe : les joueurs rejoignent leur équipe avec leur compte
export const lienInvitation = (equipeId, regenerer = false) =>
  api.post(`/equipes/${equipeId}/invitation/`, { regenerer })
export const getInvitation = (code) => api.get(`/invitations/${code}/`)
// { joueur } : « c'est moi » ; sinon { numero_maillot, prenom, nom } : nouveau joueur
export const rejoindreEquipe = (code, data) => api.post(`/invitations/${code}/rejoindre/`, data)
export const delierJoueur = (id) => api.post(`/joueurs/${id}/delier/`)

// Lien d'inscription du tournoi : les capitaines proposent leur équipe, l'organisateur valide
// options : { regenerer } remplace le lien, { desactiver } le supprime
export const lienInscription = (slug, options = {}) => api.post(`/tournois/${slug}/lien_inscription/`, options)
export const getInscription = (code) => api.get(`/inscriptions/${code}/`)
export const demanderEquipe = (code, nom) => api.post(`/inscriptions/${code}/demander/`, { nom })
export const getDemandesEquipes = (slug) => api.get('/demandes_equipes/', { params: { tournoi: slug } })
export const accepterDemande = (id) => api.post(`/demandes_equipes/${id}/accepter/`)
export const refuserDemande = (id) => api.post(`/demandes_equipes/${id}/refuser/`)
