import type { CSSProperties } from 'react'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import ThreeView from './components/ThreeView'

const placeholderStyle: CSSProperties = {
  boxSizing: 'border-box',
  padding: '1rem',
  border: '1px solid #333',
  background: '#111',
  color: '#888',
  fontFamily: 'system-ui, sans-serif',
  fontSize: '0.875rem',
}

const MAIN_GROUP_ID = 'geo-orbit-main'
const RIGHT_GROUP_ID = 'geo-orbit-right'

function App() {
  const mainLayout = useDefaultLayout({
    id: MAIN_GROUP_ID,
    storage: localStorage,
    panelIds: ['left', 'right'],
  })
  const rightLayout = useDefaultLayout({
    id: RIGHT_GROUP_ID,
    storage: localStorage,
    panelIds: ['viewer', 'bottom'],
  })

  return (
    <Group
      id={MAIN_GROUP_ID}
      orientation="horizontal"
      style={{ width: '100%', height: '100%' }}
      defaultLayout={mainLayout.defaultLayout}
      onLayoutChanged={mainLayout.onLayoutChanged}
    >
      <Panel id="left" defaultSize="40%" minSize="15%">
        <div
          style={{
            ...placeholderStyle,
            height: '100%',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          Left panel (placeholder)
        </div>
      </Panel>
      <Separator className="resize-handle resize-handle-vertical" />
      <Panel id="right" defaultSize="60%" minSize="25%">
        <Group
          id={RIGHT_GROUP_ID}
          orientation="vertical"
          style={{ width: '100%', height: '100%' }}
          defaultLayout={rightLayout.defaultLayout}
          onLayoutChanged={rightLayout.onLayoutChanged}
        >
          <Panel id="viewer" defaultSize="50%" minSize="20%">
            <div
              style={{
                minHeight: 0,
                overflow: 'hidden',
                height: '100%',
                width: '100%',
              }}
            >
              <ThreeView />
            </div>
          </Panel>
          <Separator className="resize-handle resize-handle-horizontal" />
          <Panel id="bottom" defaultSize="50%" minSize="15%">
            <div
              style={{
                ...placeholderStyle,
                height: '100%',
                minHeight: 0,
                overflow: 'auto',
              }}
            >
              Bottom right panel (placeholder)
            </div>
          </Panel>
        </Group>
      </Panel>
    </Group>
  )
}

export default App
