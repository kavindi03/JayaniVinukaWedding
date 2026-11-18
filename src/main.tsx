import React from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Guest from './pages/Guest'
import Admin from './pages/Admin'
import './styles.css'
createRoot(document.getElementById('root')!).render(
  <HashRouter><Routes>
    <Route path="/t/:table" element={<Guest />} />
    <Route path="/admin" element={<Admin />} />
    <Route path="*" element={<Navigate to="/t/1" />} />
  </Routes></HashRouter>)
