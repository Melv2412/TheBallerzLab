import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000/api'

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

// Intercepteur pour gérer les erreurs (notamment 401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Rediriger vers la connexion ou rafraîchir le token
      // console.log('Non autorisé')
    }
    console.error('Erreur API:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

// Auth
export const login = (credentials) => api.post('/token/', credentials)
export const register = (userData) => api.post('/users/', userData)

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



