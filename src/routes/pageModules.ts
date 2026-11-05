// Explicit import paths allow Vite to build one chunk per page.
export const pageModules = {
  about: () => import('../pages/About'),
  product: () => import('../pages/Product'),
  productDetail: () => import('../pages/ProductDetail'),
  news: () => import('../pages/News'),
  newsDetail: () => import('../pages/NewsDetail'),
  publications: () => import('../pages/Publication'),
  privacy: () => import('../pages/Privacy'),
  careers: () => import('../pages/Careers'),
  careersApply: () => import('../pages/CareersApply'),
}

const preloaded = new Set<string>()
export function preloadPage(path: string) {
  const pathname = path.split(/[?#]/)[0]
  const load = pathname === '/about' ? pageModules.about
    : pathname === '/product' ? pageModules.product
    : pathname.startsWith('/product/') ? pageModules.productDetail
    : pathname === '/news' ? pageModules.news
    : pathname.startsWith('/news/') ? pageModules.newsDetail
    : pathname === '/publications' ? pageModules.publications
    : pathname === '/privacy' ? pageModules.privacy
    : pathname === '/careers' ? pageModules.careers
    : pathname === '/careers/apply' ? pageModules.careersApply : null
  if (!load || preloaded.has(pathname)) return
  preloaded.add(pathname)
  // Prefetch only code for an intended navigation, never form/admin requests.
  void load().catch(() => preloaded.delete(pathname))
}
