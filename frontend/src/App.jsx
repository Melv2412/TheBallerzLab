import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import ListeTournois from './components/ListeTournois'
import DetailTournoi from './components/DetailTournoi'
import DetailMatch from './components/DetailMatch'
import MatchLive from './components/MatchLive'
import Navbar from './components/Navbar'
import ErrorBoundary from './components/ErrorBoundary'
import Login from './components/Login'
import Register from './components/Register'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="min-h-screen">
          <Navbar />
          <div className="container mx-auto px-4 py-8">
            <Routes>
              <Route path="/" element={<ListeTournois />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/tournoi/:slug" element={<DetailTournoi />} />
              <Route path="/match/:id" element={<DetailMatch />} />
              <Route path="/match/:id/live" element={<MatchLive />} />
            </Routes>
          </div>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App


