import { useCallback, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { Octopus } from './Octopus'
import { deriveColors, loadColor, saveColor } from './color-utils'
import './App.css'

export default function App() {
  const [bodyColor, setBodyColor] = useState(loadColor)
  const [showPicker, setShowPicker] = useState(false)
  const colors = deriveColors(bodyColor)

  const pickColor = useCallback((hex: string) => {
    setBodyColor(hex)
    saveColor(hex)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setShowPicker(prev => !prev)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.picker-panel')) return
    getCurrentWindow().startDragging()
  }, [])

  return (
    <div
      className="app-container"
      onContextMenu={handleContextMenu}
      onMouseDown={handleMouseDown}
    >
      <Octopus colors={colors} size={120} />

      {showPicker && (
        <div className="picker-panel" onMouseDown={e => e.stopPropagation()}>
          <button
            className="swatch-btn"
            style={{ background: '#D4804A' }}
            onClick={() => pickColor('#D4804A')}
            title="Default"
          />
          <input
            type="color"
            value={bodyColor}
            onChange={e => pickColor(e.target.value)}
            className="color-input"
          />
        </div>
      )}
    </div>
  )
}
