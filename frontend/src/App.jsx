import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ListeTournois from './components/ListeTournois'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'

// Pages chargées à la demande : l'accueil n'embarque pas le code du live ou du tournoi
const DetailTournoi = lazy(() => import('./components/DetailTournoi'))
const DetailMatch = lazy(() => import('./components/DetailMatch'))
const MatchLive = lazy(() => import('./components/MatchLive'))
const Login = lazy(() => import('./components/Login'))
const Register = lazy(() => import('./components/Register'))

const Chargement = () => (
  <div className="flex justify-center py-20">
    <div className="w-10 h-10 border-4 border-primary-orange/30 border-t-primary-orange rounded-full animate-spin" />
  </div>
)

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen">
          <Navbar />
          <div className="container mx-auto px-4 py-8">
            <Suspense fallback={<Chargement />}>
              <Routes>
                <Route path="/" element={<ListeTournois />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/tournoi/:slug" element={<DetailTournoi />} />
                <Route path="/match/:id" element={<DetailMatch />} />
                <Route path="/match/:id/live" element={<MatchLive />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App


