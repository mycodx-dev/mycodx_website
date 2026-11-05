import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Home from '../pages/Home'
import NotFound from '../pages/NotFound'
import { pageModules } from './pageModules'
import PageLoadBoundary, { PageLoading } from '../components/common/PageLoadBoundary'

const Admin = lazy(() => import('../pages/Admin'))
const About = lazy(pageModules.about)
const Product = lazy(pageModules.product)
const ProductDetail = lazy(pageModules.productDetail)
const News = lazy(pageModules.news)
const NewsDetail = lazy(pageModules.newsDetail)
const Publication = lazy(pageModules.publications)
const Privacy = lazy(pageModules.privacy)
const Careers = lazy(pageModules.careers)
const CareersApply = lazy(pageModules.careersApply)

export default function AppRoutes() {
  const { pathname } = useLocation()
  return (
    <PageLoadBoundary key={pathname}><Suspense fallback={<PageLoading />}>
    <Routes>
      <Route path="/admin" element={<Suspense fallback={<p role="status">관리자 화면을 불러오는 중입니다.</p>}><Admin /></Suspense>} />
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
    </Suspense></PageLoadBoundary>
  )
}
