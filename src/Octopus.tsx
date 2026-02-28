import { useCallback, useEffect, useRef, useState } from 'react'

interface OctopusColors {
  body: string
  eye: string
  glow: string
}

interface OctopusProps {
  colors: OctopusColors
  size?: number
  className?: string
}

/** Merge adjacent pixels in the same row into wider spans to eliminate WebKit rendering seams */
function mergeSpans(pixels: [number, number][]): { r: number; c: number; w: number }[] {
  const byRow = new Map<number, number[]>()
  for (const [r, c] of pixels) {
    if (!byRow.has(r)) byRow.set(r, [])
    byRow.get(r)!.push(c)
  }
  const spans: { r: number; c: number; w: number }[] = []
  for (const [r, cols] of byRow) {
    cols.sort((a, b) => a - b)
    let start = cols[0], end = cols[0]
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] === end + 1) {
        end = cols[i]
      } else {
        spans.push({ r, c: start, w: end - start + 1 })
        start = end = cols[i]
      }
    }
    spans.push({ r, c: start, w: end - start + 1 })
  }
  return spans
}

const HEAD_PIXELS: [number, number][] = [
  [1,4],[1,5],[1,6],[1,7],[1,8],
  [2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[2,9],
  [3,2],[3,3],[3,6],[3,9],[3,10],
  [4,2],[4,3],[4,6],[4,9],[4,10],
  [5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],
  [6,3],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],
]

const LEFT_EYE_PIXELS: [number, number][] = [[3,4],[3,5],[4,4],[4,5]]
const RIGHT_EYE_PIXELS: [number, number][] = [[3,7],[3,8],[4,7],[4,8]]

const HEAD = mergeSpans(HEAD_PIXELS)
const LEFT_EYE = mergeSpans(LEFT_EYE_PIXELS)
const RIGHT_EYE = mergeSpans(RIGHT_EYE_PIXELS)

// Pre-merged vertical tentacle spans: { c, r, h }
const TENTACLE_GROUPS = [
  { c: 3, r: 8, h: 3 },  // left outer
  { c: 5, r: 8, h: 2 },  // left inner
  { c: 7, r: 8, h: 2 },  // right inner
  { c: 9, r: 8, h: 3 },  // right outer
]

const LOOK_DIRS: { x: number; y: number }[] = [
  { x: -1, y: -1 }, { x: 1, y: -1 },
  { x: -1, y: 1 },  { x: 1, y: 1 },
  { x: 0, y: -1 },  { x: 0, y: 1 },
  { x: -1, y: 0 },  { x: 1, y: 0 },
]

export function Octopus({ colors, size = 120, className }: OctopusProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })
  const [isBlinking, setIsBlinking] = useState(false)
  const [isCrossEyed, setIsCrossEyed] = useState(false)
  const [crossEyedY, setCrossEyedY] = useState(4)
  const [isHovered, setIsHovered] = useState(false)
  const [randomPupil, setRandomPupil] = useState<{ x: number; y: number } | null>(null)
  const [wiggleGroups, setWiggleGroups] = useState<Set<number>>(new Set())
  const [flashRow, setFlashRow] = useState<number | null>(null)
  const [eyeMode, setEyeMode] = useState<'track' | 'wander'>('track')
  const blinkRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const idleRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const eyeRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const flashRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lastMouseMoveRef = useRef(0)

  // Mouse tracking — each axis independent
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      lastMouseMoveRef.current = Date.now()
      if (eyeMode === 'wander') {
        setEyeMode('track')
        setRandomPupil(null)
      }
      if (!svgRef.current) return
      const rect = svgRef.current.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height * 0.35
      const dx = e.clientX - cx
      const dy = e.clientY - cy
      const dead = 30
      setPupilOffset({
        x: Math.abs(dx) > dead ? (dx > 0 ? 1 : -1) : 0,
        y: Math.abs(dy) > dead ? (dy > 0 ? 1 : -1) : 0,
      })
    }
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [eyeMode])

  // Eye mode cycle: track 5-8s -> wander 0.8-2s (only if mouse idle > 2s)
  useEffect(() => {
    const cycle = () => {
      setEyeMode('track')
      setRandomPupil(null)
      const trackDur = 5000 + Math.random() * 3000
      eyeRef.current = setTimeout(() => {
        const mouseIdle = Date.now() - lastMouseMoveRef.current
        if (mouseIdle < 2000) { cycle(); return }
        setEyeMode('wander')
        const mouseX = pupilOffset.x < 0 ? -1 : pupilOffset.x > 0 ? 1 : 0
        const mouseY = pupilOffset.y < 0 ? -1 : pupilOffset.y > 0 ? 1 : 0
        const away = LOOK_DIRS.filter(d => d.x !== mouseX || d.y !== mouseY)
        const dir = away[Math.floor(Math.random() * away.length)]
        setRandomPupil(dir)
        const wanderDur = 800 + Math.random() * 1200
        eyeRef.current = setTimeout(cycle, wanderDur)
      }, trackDur)
    }
    cycle()
    return () => clearTimeout(eyeRef.current)
  }, []) // eslint-disable-line

  // Auto blink: double 25%, slow 15%, normal 60%
  useEffect(() => {
    const schedule = () => {
      const delay = 2000 + Math.random() * 6000
      blinkRef.current = setTimeout(() => {
        const roll = Math.random()
        if (roll < 0.25) {
          setIsBlinking(true)
          setTimeout(() => {
            setIsBlinking(false)
            setTimeout(() => {
              setIsBlinking(true)
              setTimeout(() => { setIsBlinking(false); schedule() }, 80)
            }, 150)
          }, 80)
        } else if (roll < 0.40) {
          setIsBlinking(true)
          setTimeout(() => { setIsBlinking(false); schedule() }, 250)
        } else {
          setIsBlinking(true)
          setTimeout(() => { setIsBlinking(false); schedule() }, 100)
        }
      }, delay)
    }
    schedule()
    return () => clearTimeout(blinkRef.current)
  }, [])

  // Flash sweep — head only, every 15-20s
  useEffect(() => {
    const schedule = () => {
      const delay = 15000 + Math.random() * 5000
      flashRef.current = setTimeout(() => {
        const rows = [1,2,3,4,5,6]
        rows.forEach((row, i) => {
          setTimeout(() => setFlashRow(row), i * 70)
        })
        setTimeout(() => setFlashRow(null), rows.length * 70)
        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(flashRef.current)
  }, [])

  // Random idle: wiggle 40%, wave 20%, cross-eyed 20%, nothing 20%
  useEffect(() => {
    const schedule = () => {
      const delay = 5000 + Math.random() * 3000
      idleRef.current = setTimeout(() => {
        const roll = Math.random()

        if (roll < 0.40) {
          const count = Math.random() < 0.4 ? 2 : 1
          const indices = new Set<number>()
          while (indices.size < count) {
            indices.add(Math.floor(Math.random() * 4))
          }
          setWiggleGroups(indices)
          setTimeout(() => setWiggleGroups(new Set()), 250 + Math.random() * 200)
        } else if (roll < 0.60) {
          ;[0, 1, 2, 3].forEach((gi, i) => {
            setTimeout(() => {
              setWiggleGroups(new Set([gi]))
              setTimeout(() => setWiggleGroups(new Set()), 200)
            }, i * 150)
          })
        } else if (roll < 0.80) {
          setIsCrossEyed(true)
          setCrossEyedY(Math.random() < 0.5 ? 3 : 4)
          const dur = 1500 + Math.random() * 500
          setTimeout(() => {
            setIsBlinking(true)
            setTimeout(() => { setIsCrossEyed(false); setIsBlinking(false) }, 100)
          }, dur)
        }

        schedule()
      }, delay)
    }
    schedule()
    return () => clearTimeout(idleRef.current)
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
    setIsBlinking(true)
    setTimeout(() => setIsBlinking(false), 120)
    // Tentacles wave outward (inner -> outer)
    setTimeout(() => { setWiggleGroups(new Set([1, 2])) }, 50)
    setTimeout(() => { setWiggleGroups(new Set([0, 1, 2, 3])) }, 150)
    setTimeout(() => { setWiggleGroups(new Set([0, 3])) }, 300)
    setTimeout(() => { setWiggleGroups(new Set()) }, 450)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  // Resolve pupil direction
  const effectivePupil = eyeMode === 'wander' && randomPupil ? randomPupil : pupilOffset
  const pupilX = effectivePupil.x < 0 ? 0 : effectivePupil.x > 0 ? 1 : 0
  const pupilY = effectivePupil.y < 0 ? 0 : effectivePupil.y > 0 ? 1 : 0

  let leftPx = 4 + pupilX, leftPy = 3 + pupilY
  let rightPx = 7 + pupilX, rightPy = 3 + pupilY

  if (isCrossEyed) {
    leftPx = 5; leftPy = crossEyedY
    rightPx = 7; rightPy = crossEyedY
  }

  const eyesClosed = isBlinking

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 13 14"
      width={size}
      height={size}
      shapeRendering="crispEdges"
      className={`select-none${className ? ` ${className}` : ''}`}
      style={{
        filter: `drop-shadow(0 0 4px ${colors.glow})`,
        transform: isHovered ? 'translateY(-8px)' : 'translateY(0)',
        transition: 'filter 0.5s ease, transform 0.4s ease-out',
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Head — merged spans */}
      {HEAD.map((s, i) => (
        <rect key={`h${i}`} x={s.c} y={s.r} width={s.w} height={1.02}
          fill={flashRow === s.r ? colors.eye : colors.body} />
      ))}

      {/* Eyes 2x2 — merged spans */}
      {LEFT_EYE.map((s, i) => (
        <rect key={`el${i}`} x={s.c} y={s.r} width={s.w} height={1.02}
          fill={eyesClosed ? colors.body : colors.eye} />
      ))}
      {RIGHT_EYE.map((s, i) => (
        <rect key={`er${i}`} x={s.c} y={s.r} width={s.w} height={1.02}
          fill={eyesClosed ? colors.body : colors.eye} />
      ))}

      {/* Pupils */}
      {!eyesClosed && (
        <>
          <rect x={leftPx} y={leftPy} width={1} height={1.02} fill="#0A0908" />
          <rect x={rightPx} y={rightPy} width={1} height={1.02} fill="#0A0908" />
        </>
      )}

      {/* Tentacles — pre-merged vertical spans */}
      {TENTACLE_GROUPS.map((t, gi) => (
        <rect key={`t${gi}`}
          x={t.c + (wiggleGroups.has(gi) ? (gi < 2 ? -1 : 1) : 0)}
          y={t.r}
          width={1} height={t.h}
          fill={colors.body}
          opacity={wiggleGroups.has(gi) ? 0.65 : 0.45}
        />
      ))}

    </svg>
  )
}
