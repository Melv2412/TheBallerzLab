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

// Intercepteur pour injecter le token JWT
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Un seul rafraîchissement à la fois, partagé par les requêtes en échec
let refreshEnCours = null

const rafraichirToken = () => {
  if (!refreshEnCours) {
    const refresh = localStorage.getItem('refresh')
    refreshEnCours = (refresh
      ? axios.post(`${API_BASE_URL}/token/refresh/`, { refresh })
      : Promise.reject(new Error('Pas de refresh token'))
    )
      .then((response) => {
        localStorage.setItem('token', response.data.access)
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

// Premier message d'erreur renvoyé par l'API (ex. « Un tournoi ne peut pas dépasser 32 équipes. »)
export const messageErreur = (error, defaut = 'Une erreur est survenue.') => {
  const data = error?.response?.data
  if (!data) return defaut
  if (typeof data === 'string') return defaut
  if (data.detail) return String(data.detail)
  const premier = Object.values(data).flat()[0]
  return typeof premier === 'string' ? premier : defaut
}

// Tournois
export const getTournois = (search = '') => {
  const url = search ? `/tournois/?search=${encodeURIComponent(search)}` : '/tournois/'
  return api.get(url)
}
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

// Équipes
export const getEquipes = (tournoiId = null) => {
  const url = tournoiId ? `/equipes/?tournoi=${tournoiId}` : '/equipes/'
  return api.get(url)
}
export const createEquipe = (data) => api.post('/equipes/', data)
export const updateEquipe = (id, data) => api.patch(`/equipes/${id}/`, data)
export const deleteEquipe = (id) => api.delete(`/equipes/${id}/`)

// Joueurs
export const getJoueurs = (equipeId = null) => {
  const url = equipeId ? `/joueurs/?equipe=${equipeId}` : '/joueurs/'
  return api.get(url)
}
export const getJoueursTournoi = (tournoi) => api.get(`/joueurs/?tournoi=${encodeURIComponent(tournoi)}`)
export const createJoueur = (data) => api.post('/joueurs/', data)
export const updateJoueur = (id, data) => api.patch(`/joueurs/${id}/`, data)
export const deleteJoueur = (id) => api.delete(`/joueurs/${id}/`)

// Matchs
export const getMatchs = (tournoiId = null, statut = null) => {
  let url = '/matchs/'
  const params = new URLSearchParams()
  if (tournoiId) params.append('tournoi', tournoiId)
  if (statut) params.append('statut', statut)
  if (params.toString()) url += `?${params.toString()}`
  return api.get(url)
}
export const getMatch = (id) => api.get(`/matchs/${id}/`)
export const createMatch = (data) => api.post('/matchs/', data)
export const updateMatch = (id, data) => api.patch(`/matchs/${id}/`, data)
export const deleteMatch = (id) => api.delete(`/matchs/${id}/`)
export const initialiserStatsMatch = (id) => api.post(`/matchs/${id}/initialiser_stats/`)

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



