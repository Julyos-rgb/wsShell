import Sidebar from './components/Sidebar'
import Terminal from './components/Terminal'
import FileManager from './components/FileManager'
import StatusBar from './components/StatusBar'
import AddServerDialog from './components/AddServerDialog'
import { useUIStore } from './stores/ui'

function App() {
  const { activeTab, activeServerId } = useUIStore()

  return (
    <div className="flex flex-col h-screen w-screen bg-background text-white overflow-hidden">
      <div className="bg-tertiary px-3 py-1.5 flex items-center justify-between border-b border-secondary flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-500 ml-2">wsShell</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{activeServerId ? `已连接` : '未连接'}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <div className="bg-tertiary flex border-b border-secondary flex-shrink-0">
            <button
              className={`px-4 py-1.5 text-sm transition-colors ${
                activeTab === 'terminal'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => useUIStore.getState().setActiveTab('terminal')}
            >
              终端
            </button>
            <button
              className={`px-4 py-1.5 text-sm transition-colors ${
                activeTab === 'vnc'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => useUIStore.getState().setActiveTab('vnc')}
            >
              VNC
            </button>
            <button
              className={`px-4 py-1.5 text-sm transition-colors ${
                activeTab === 'file'
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
              onClick={() => useUIStore.getState().setActiveTab('file')}
            >
              文件
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {activeTab === 'terminal' && <Terminal />}
            {activeTab === 'vnc' && (
              <div className="flex items-center justify-center h-full text-gray-600">
                <div className="text-center">
                  <div className="text-4xl mb-3">🖥</div>
                  <div>VNC 远程桌面功能开发中</div>
                  <div className="text-sm mt-1">将在第二阶段实现</div>
                </div>
              </div>
            )}
            {activeTab === 'file' && <FileManager />}
          </div>
        </div>
      </div>

      <StatusBar />
      <AddServerDialog />
    </div>
  )
}

export default App
