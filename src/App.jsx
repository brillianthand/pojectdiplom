import { useEffect, useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Board } from './components/board/Board'
import { CalendarView } from './components/views/CalendarView'
import { ListView } from './components/views/ListView'
import { MembersView } from './components/views/MembersView'
import { MyTasksView } from './components/views/MyTasksView'
import { NotificationsView } from './components/views/NotificationsView'
import { ReportsView } from './components/views/ReportsView'
import { SettingsView } from './components/views/SettingsView'
import { WorkspaceView } from './components/views/WorkspaceView'
import { AdminView } from './components/views/AdminView'
import { BacklogView } from './components/views/BacklogView'
import { TaskModal } from './components/task/TaskModal'
import { LoadingScreen } from './components/ui/LoadingScreen'
import { Toast } from './components/ui/Toast'
import { LoginPage } from './components/auth/LoginPage'
import { RegisterPage } from './components/auth/RegisterPage'
import { useStore } from './store/useStore'
import { SharedBoardView } from './components/views/SharedBoardView'

function NoProjectsScreen() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-fg-muted">
      <FolderKanban size={48} strokeWidth={1} />
      <p className="text-lg font-medium text-fg-secondary">Нет проектов</p>
      <p className="text-sm">Создайте первый проект с помощью кнопки «+» в боковом меню</p>
    </div>
  )
}

export default function App() {
  const sharedToken = window.location.pathname.match(/^\/shared\/([^/]+)/)?.[1]

  const { theme, view, initialize, initialized, apiError, dismissError } = useStore()
  const [showLoader, setShowLoader] = useState(false)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    if (sharedToken) return
    initialize()
    const t = setTimeout(() => setShowLoader(true), 200)
    return () => clearTimeout(t)
  }, [])

  if (sharedToken) return <SharedBoardView token={sharedToken} />

  if (!initialized) return showLoader ? <LoadingScreen /> : null

  if (view === 'login')    return <><LoginPage /><Toast message={apiError} onDismiss={dismissError} /></>
  if (view === 'register') return <><RegisterPage /><Toast message={apiError} onDismiss={dismissError} /></>

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <Header />

        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          {view === 'workspace'     && <WorkspaceView />}
          {view === 'board'         && <Board />}
          {view === 'list'          && <ListView />}
          {view === 'calendar'      && <CalendarView />}
          {view === 'members'       && <MembersView />}
          {view === 'my-tasks'      && <MyTasksView />}
          {view === 'notifications' && <NotificationsView />}
          {view === 'reports'       && <ReportsView />}
          {view === 'settings'      && <SettingsView />}
          {view === 'admin'         && <AdminView />}
          {view === 'backlog'       && <BacklogView />}
          {view === 'no-projects'   && <NoProjectsScreen />}
        </main>
      </div>

      <TaskModal />
      <Toast message={apiError} onDismiss={dismissError} />
    </div>
  )
}
