import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import ListeTournois from './components/ListeTournois'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'

// Pages chargées à la demande : l'accueil n'embarque pas le code du live ou du tournoi
const DetailTournoi = lazy(() => import('./components/DetailTournoi'))
const DetailMatch = lazy(() => import('./components/DetailMatch'))
const MatchLive = lazy(() => import('./components/MatchLive'))
const FeuilleMatch = lazy(() => import('./components/FeuilleMatch'))
const EcranSalle = lazy(() => import('./components/EcranSalle'))
const SaisieFeuille = lazy(() => import('./components/SaisieFeuille'))
const ProfilAthlete = lazy(() => import('./components/ProfilAthlete'))
const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))

const Chargement = () => (
  <div className="flex justify-center py-20">
    <div className="w-10 h-10 border-4 border-primary-orange/30 border-t-primary-orange rounded-full animate-spin" />
  </div>
)

function Pages() {
  // L'écran de salle occupe tout l'écran : pas de barre de navigation
  const ecranSalle = useLocation().pathname.endsWith('/ecran')
  return (
    <div className="min-h-screen">
      {!ecranSalle && (
        <div className="print:hidden">
          <Navbar />
        </div>
      )}
      <div className={ecranSalle ? '' : 'container mx-auto px-4 py-8 print:p-0 print:max-w-none'}>
        <Suspense fallback={<Chargement />}>
          <Routes>
            <Route path="/" element={<ListeTournois />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/tournoi/:slug" element={<DetailTournoi />} />
            <Route path="/match/:id" element={<DetailMatch />} />
            <Route path="/match/:id/live" element={<MatchLive />} />
            <Route path="/match/:id/feuille" element={<FeuilleMatch />} />
            <Route path="/match/:id/ecran" element={<EcranSalle />} />
            <Route path="/match/:id/saisie" element={<SaisieFeuille />} />
            <Route path="/athlete/:id" element={<ProfilAthlete />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Pages />
      </Router>
    </ErrorBoundary>
  )
}

export default App


