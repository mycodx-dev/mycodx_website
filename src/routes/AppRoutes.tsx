import { Navigate, Routes, Route } from 'react-router-dom'
import About from '../pages/About'
import Home from '../pages/Home'
import News from '../pages/News'
import NewsDetail from '../pages/NewsDetail'
import Product from '../pages/Product'
import ProductDetail from '../pages/ProductDetail'
import Publication from '../pages/Publication'
import Privacy from '../pages/Privacy'
import Careers from '../pages/Careers'
import CareersApply from '../pages/CareersApply'
import NotFound from '../pages/NotFound'

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/about" element={<About />} />
      <Route path="/product" element={<Product />} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/gallery" element={<Navigate to="/" replace />} />
      <Route path="/news" element={<News />} />
      <Route path="/news/:id" element={<NewsDetail />} />
      <Route path="/publications" element={<Publication />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/careers" element={<Careers />} />
      <Route path="/careers/apply" element={<CareersApply />} />
      <Route path="/research" element={<Navigate to="/about" replace />} />
      <Route path="/research/introduction" element={<Navigate to="/about" replace />} />
      <Route path="/research/areas" element={<Navigate to="/" replace />} />
      <Route path="/publication" element={<Navigate to="/publications" replace />} />
      <Route path="/members" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
