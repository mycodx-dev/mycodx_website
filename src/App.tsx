import AppRoutes from './routes/AppRoutes'
import Layout from './components/layouts/Layout'
import './styles/about.css'
import './styles/careers.css'
import './styles/home.css'
import './styles/pages.css'
import './styles/publication.css'
import './styles/research.css'

function App() {
  return (
    <Layout>
      <AppRoutes />
    </Layout>
  )
}

export default App
