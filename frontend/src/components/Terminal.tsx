import React, { useRef, useEffect, useCallback } from 'react'
import { Terminal as XTermTerminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import 'xterm/css/xterm.css'
import { useUIStore, useConnectionStore } from '../stores/ui'
import { WriteToSession, ResizeTerminal } from '../../wailsjs/go/ssh/SSHService'
import { EventsOn } from '../../wailsjs/runtime/runtime'

const Terminal: React.FC = () => {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTermTerminal | null>(null)
  const fitAddonRef = useRef<FitAddon>(new FitAddon())
  const { activeServerId } = useUIStore()
  const { connections } = useConnectionStore()

  const getSessionId = useCallback(() => {
    if (!activeServerId) return null
    return connections.get(activeServerId)?.sessionId || null
  }, [activeServerId, connections])

  useEffect(() => {
    if (!terminalRef.current) return

    const term = new XTermTerminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#d4d4d4',
        cursor: '#64ffda',
        cursorAccent: '#0a0a0a',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      allowProposedApi: true,
    })

    const fitAddon = fitAddonRef.current
    term.loadAddon(fitAddon)
    try {
      term.loadAddon(new WebLinksAddon())
    } catch (e) {
      // web-links addon optional
    }

    term.open(terminalRef.current)

    setTimeout(() => {
      fitAddon.fit()
    }, 50)

    term.writeln('\x1b[1;36mwsShell Terminal\x1b[0m')
    term.writeln('\x1b[90m选择左侧服务器开始连接...\x1b[0m')
    term.writeln('')

    term.onData(async (data) => {
      const sessionId = getSessionId()
      if (!sessionId) {
        term.write(data)
        return
      }
      try {
        await WriteToSession({ sessionId, data })
      } catch (e) {
        console.error('write error:', e)
      }
    })

    xtermRef.current = term

    const handleResize = () => {
      fitAddon.fit()
      const sessionId = getSessionId()
      if (sessionId && term.rows && term.cols) {
        ResizeTerminal({ sessionId, rows: term.rows, cols: term.cols }).catch(() => {})
      }
    }

    window.addEventListener('resize', handleResize)

    const resizeObserver = new ResizeObserver(() => {
      setTimeout(handleResize, 100)
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      term.dispose()
    }
  }, [])

  useEffect(() => {
    const term = xtermRef.current
    if (!term) return

    const sessionId = getSessionId()
    if (!sessionId) return

    term.clear()
    term.writeln(`\x1b[1;32mConnecting to ${sessionId}...\x1b[0m`)
    term.writeln('')

    const eventHandler = (data: string) => {
      term.write(data)
    }

    EventsOn(`ssh:${sessionId}:stdout`, eventHandler)
    EventsOn(`ssh:${sessionId}:stderr`, eventHandler)

    setTimeout(() => {
      if (fitAddonRef.current) {
        fitAddonRef.current.fit()
      }
      if (term.rows && term.cols) {
        ResizeTerminal({ sessionId, rows: term.rows, cols: term.cols }).catch(() => {})
      }
    }, 200)

    return () => {
      EventsOn(`ssh:${sessionId}:stdout`, () => {})
      EventsOn(`ssh:${sessionId}:stderr`, () => {})
    }
  }, [activeServerId, connections, getSessionId])

  return (
    <div className="w-full h-full bg-[#0a0a0a]">
      <div ref={terminalRef} className="w-full h-full" />
    </div>
  )
}

export default Terminal
