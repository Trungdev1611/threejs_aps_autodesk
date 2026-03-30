import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'

/** Add two vec3 (used to accumulate group offsets -> world center). */
function addVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/**
 * A box part (mesh) in the scene:
 * - `centerInGroup`: box center in the tower group local space (same as <mesh> `position`).
 * - `size`: `boxGeometry args` = [width X, height Y, depth Z]. Three.js boxes are center-aligned at `position`.
 */
type BuildingPartDef = {
  name: string
  centerInGroup: [number, number, number]
  size: [number, number, number]
  color: string
}

/**
 * Each tower is a child <group> in ThreeBuildings.
 * `groupPosition`: offsets the whole tower relative to the ThreeBuildings root.
 */
type TowerDef = {
  id: string
  label: string
  groupPosition: [number, number, number]
  parts: BuildingPartDef[]
}

/**
 * Root offset of the whole ThreeBuildings cluster in the scene (Canvas world parent).
 * World center = rootOffset + groupPosition + centerInGroup (vector addition).
 */
const THREE_BUILDINGS_ROOT: [number, number, number] = [0, -0.5, 0]

/** Three towers: shared data for both rendering and metrics panel. */
const TOWERS: TowerDef[] = [
  {
    id: 'left',
    label: 'Left tower',
    groupPosition: [-4, 0, 0],
    parts: [
      { name: 'Base', centerInGroup: [0, 0.5, 0], size: [3, 1, 2.5], color: '#5c6b7a' },
      { name: 'Shaft', centerInGroup: [0, 2.25, 0], size: [2.2, 3, 2.2], color: '#5c6b7a' },
      { name: 'Top', centerInGroup: [0, 4.35, 0.35], size: [1.2, 1.2, 1], color: '#c9d4e0' },
    ],
  },
  {
    id: 'center',
    label: 'Center tower',
    groupPosition: [0, 0, 0],
    parts: [
      { name: 'Base', centerInGroup: [0, 0.5, 0], size: [3, 1, 2.5], color: '#b4426a' },
      { name: 'Shaft', centerInGroup: [0, 2.25, 0], size: [2.2, 3, 2.2], color: '#b4426a' },
      { name: 'Top', centerInGroup: [0, 4.35, 0.35], size: [1.2, 1.2, 1], color: '#c9d4e0' },
    ],
  },
  {
    id: 'right',
    label: 'Right tower',
    groupPosition: [4, 0, 0],
    parts: [
      { name: 'Base', centerInGroup: [0, 0.5, 0], size: [3, 1, 2.5], color: '#42b48e' },
      { name: 'Shaft', centerInGroup: [0, 2.25, 0], size: [2.2, 3, 2.2], color: '#42b48e' },
      { name: 'Top', centerInGroup: [0, 4.35, 0.35], size: [1.2, 1.2, 1], color: '#c9d4e0' },
    ],
  },
]

type MetricRow = {
  towerLabel: string
  partName: string
  /** Box center in world space (root + group + local center). */
  worldCenter: [number, number, number]
  /** Box size: width X × height Y × depth Z (scene units). */
  size: [number, number, number]
}

/**
 * Build a metrics row per part.
 * Formula: worldCenter = THREE_BUILDINGS_ROOT + tower.groupPosition + part.centerInGroup
 */
function buildMetricRows(): MetricRow[] {
  const rows: MetricRow[] = []
  for (const tower of TOWERS) {
    const groupWorld = addVec3(THREE_BUILDINGS_ROOT, tower.groupPosition)
    for (const part of tower.parts) {
      rows.push({
        towerLabel: tower.label,
        partName: part.name,
        worldCenter: addVec3(groupWorld, part.centerInGroup),
        size: part.size,
      })
    }
  }
  return rows
}

function ThreeBuildings({ showCenterMarkers }: { showCenterMarkers: boolean }) {
  return (
    <group position={THREE_BUILDINGS_ROOT}>
      {/*
        Each tower is offset by groupPosition (mostly X).
        Each part is wrapped in <group position={centerInGroup}> so local origin = box center.
        Debug marker: a sphere at the local origin (center). depthTest=false keeps it visible.
      */}
      {TOWERS.map((tower) => (
        <group key={tower.id} position={tower.groupPosition}>
          {tower.parts.map((part) => (
            <group key={`${tower.id}-${part.name}`} position={part.centerInGroup}>
              <mesh castShadow receiveShadow>
                <boxGeometry args={part.size} />
                <meshStandardMaterial color={part.color} metalness={0.12} roughness={0.55} />
              </mesh>
              {showCenterMarkers && (
                <mesh name={`center-marker-${tower.id}-${part.name}`}>
                  <sphereGeometry args={[0.14, 20, 20]} />
                  <meshStandardMaterial
                    color="#ffd60a"
                    emissive="#cc8800"
                    emissiveIntensity={0.45}
                    depthTest={false}
                    toneMapped={false}
                  />
                </mesh>
              )}
            </group>
          ))}
        </group>
      ))}

      {/* Ground plane (not part of tower metrics). */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#2a2f36" roughness={0.9} />
      </mesh>
    </group>
  )
}

function formatVec3(v: [number, number, number]): string {
  return `(${v.map((n) => n.toFixed(2)).join(', ')})`
}

export function ThreeDemoPage() {
  const metricRows = useMemo(() => buildMetricRows(), [])
  const [showCenterMarkers, setShowCenterMarkers] = useState(false)

  return (
    <div className="page page-fill">
      <h1>Three.js (React Three Fiber)</h1>
      <p className="lede">
        Three towers are described via data; the right panel shows <strong>world centers</strong> and{' '}
        <strong>sizes</strong> per block.
      </p>

      <label className="three-debug-toggle">
        <input
          type="checkbox"
          checked={showCenterMarkers}
          onChange={(e) => setShowCenterMarkers(e.target.checked)}
        />
        <span>Show block centers (debug) — yellow spheres</span>
      </label>

      <div className="three-demo-layout">
        <div className="canvas-wrap">
          <Canvas shadows camera={{ position: [14, 8, 14], fov: 45 }}>
            <color attach="background" args={['#1a1d22']} />
            <ambientLight intensity={0.35} />
            <directionalLight
              castShadow
              position={[6, 10, 4]}
              intensity={1.2}
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <ThreeBuildings showCenterMarkers={showCenterMarkers} />
            <OrbitControls makeDefault minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.05} />
            <Environment preset="city" />
          </Canvas>
        </div>

        <aside className="three-metrics-panel" aria-label="Block center and size">
          <h2>World center &amp; size</h2>
          {metricRows.map((row, i) => (
            <div key={i} className="metric-block">
              <div className="metric-title">
                {row.towerLabel} — {row.partName}
              </div>
              <table>
                <tbody>
                  <tr>
                    <th>World center</th>
                    <td className="mono">{formatVec3(row.worldCenter)}</td>
                  </tr>
                  <tr>
                    <th>
                      Size
                      <br />
                      <span style={{ fontWeight: 400, opacity: 0.8 }}>width×height×depth</span>
                    </th>
                    <td className="mono">
                      {row.size[0]} × {row.size[1]} × {row.size[2]}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ))}
          <p className="note">
            <strong>Note:</strong> Y is height. <em>World center</em> is the box center after adding the
            <code>ThreeBuildings</code> root offset ({formatVec3(THREE_BUILDINGS_ROOT)}), tower group offset,
            and mesh/group local position. Size matches <code>boxGeometry args</code>.
          </p>
        </aside>
      </div>
    </div>
  )
}
