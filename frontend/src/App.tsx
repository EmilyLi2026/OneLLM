import { Routes, Route } from 'react-router-dom'
import Layout from './layout/Layout'
import Home from './pages/Home'
import Products from './pages/Products'
import Explore from './pages/Explore'
import Models from './pages/Models'
import Calculator from './pages/Calculator'
import Enterprise from './pages/Enterprise'
import Pricing from './pages/Pricing'
import Integrations from './pages/Integrations'
import Comparison from './pages/Comparison'
import Contact from './pages/Contact'
import Docs from './pages/Docs'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/models" element={<Models />} />
        <Route path="/calculator" element={<Calculator />} />
        <Route path="/enterprise" element={<Enterprise />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/integrations" element={<Integrations />} />
        <Route path="/comparison" element={<Comparison />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/docs" element={<Docs />} />
      </Route>
    </Routes>
  )
}
