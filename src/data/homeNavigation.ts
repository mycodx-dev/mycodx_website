interface HomeNavigationItem {
  titleKey: string
  path: string
}

export const homeNavigation: HomeNavigationItem[] = [
  {
    titleKey: 'header.navigation.about',
    path: '/about',
  },
  {
    titleKey: 'header.navigation.product',
    path: '/product',
  },
  {
    titleKey: 'header.navigation.news',
    path: '/news',
  },
  {
    titleKey: 'header.navigation.publications',
    path: '/publications',
  },
  {
    titleKey: 'header.navigation.careers',
    path: '/careers',
  },
  {
    titleKey: 'header.navigation.contact',
    path: '/#contact',
  },
] as const
