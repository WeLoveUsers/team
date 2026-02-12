import { useState } from 'react'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('authToken'))

  const handleLogout = () => {
    localStorage.removeItem('authToken')
    setIsLoggedIn(false)
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />
  }

  return <DashboardPage onLogout={handleLogout} />
}

export default App
