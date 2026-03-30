import { useMemo, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'

/** Cộng hai vec3 (dùng khi cộng dồn offset nhóm → tâm world). */
function addVec3(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

/**
 * Một khối hộp (mesh) trong scene:
 * - `centerInGroup`: tâm hình hộp trong **hệ tọa độ local của group tòa** (trùng với prop `position` của <mesh>).
 * - `size`: tham số `boxGeometry args` = [chiều rộng X, cao Y, sâu Z]. Three.js đặt hộp **căn tâm** tại `position`.
 */
type BuildingPartDef = {
  name: string
  centerInGroup: [number, number, number]
  size: [number, number, number]
  color: string
}

/**
 * Mỗi tòa = một <group> con trong ThreeBuildings.
 * `groupPosition`: dịch cả tòa so với gốc của ThreeBuildings (ví dụ bên trái X âm).
 */
type TowerDef = {
  id: string
  label: string
  groupPosition: [number, number, number]
  parts: BuildingPartDef[]
}

/**
 * Offset gốc của cả cụm ThreeBuildings trong scene (parent của Canvas world).
 * Mọi "tâm world" bên dưới = rootOffset + groupPosition + centerInGroup (cộng vector).
 */
const THREE_BUILDINGS_ROOT: [number, number, number] = [0, -0.5, 0]

/** Ba tòa: dữ liệu dùng chung để vừa render mesh vừa tính bảng tọa độ. */
const TOWERS: TowerDef[] = [
  {
    id: 'left',
    label: 'Tòa trái',
    groupPosition: [-4, 0, 0],
    parts: [
      { name: 'Đế', centerInGroup: [0, 0.5, 0], size: [3, 1, 2.5], color: '#5c6b7a' },
      { name: 'Thân', centerInGroup: [0, 2.25, 0], size: [2.2, 3, 2.2], color: '#5c6b7a' },
      { name: 'Khối mái', centerInGroup: [0, 4.35, 0.35], size: [1.2, 1.2, 1], color: '#c9d4e0' },
    ],
  },
  {
    id: 'center',
    label: 'Tòa giữa',
    groupPosition: [0, 0, 0],
    parts: [
      { name: 'Đế', centerInGroup: [0, 0.5, 0], size: [3, 1, 2.5], color: '#b4426a' },
      { name: 'Thân', centerInGroup: [0, 2.25, 0], size: [2.2, 3, 2.2], color: '#b4426a' },
      { name: 'Khối mái', centerInGroup: [0, 4.35, 0.35], size: [1.2, 1.2, 1], color: '#c9d4e0' },
    ],
  },
  {
    id: 'right',
    label: 'Tòa phải',
    groupPosition: [4, 0, 0],
    parts: [
      { name: 'Đế', centerInGroup: [0, 0.5, 0], size: [3, 1, 2.5], color: '#42b48e' },
      { name: 'Thân', centerInGroup: [0, 2.25, 0], size: [2.2, 3, 2.2], color: '#42b48e' },
      { name: 'Khối mái', centerInGroup: [0, 4.35, 0.35], size: [1.2, 1.2, 1], color: '#c9d4e0' },
    ],
  },
]

type MetricRow = {
  towerLabel: string
  partName: string
  /** Tâm khối trong hệ world của scene (đã cộng root + group + local center). */
  worldCenter: [number, number, number]
  /** Kích thước hộp: rộng X × cao Y × sâu Z (đơn vị giống scene, thường là mét tùy bạn quy ước). */
  size: [number, number, number]
}

/**
 * Từ định nghĩa tòa + part → một dòng bảng: tâm world và size.
 * Công thức: worldCenter = THREE_BUILDINGS_ROOT + tower.groupPosition + part.centerInGroup
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
        Lặp từng tòa: groupPosition dịch cả khối mesh theo trục (ở đây chủ yếu X).
        Mỗi part bọc trong <group position={centerInGroup}>: gốc local = tâm hộp (boxGeometry căn tâm tại 0,0,0).
        Marker debug: sphere cùng gốc → trùng tâm khối; depthTest=false để luôn nhìn thấy khi bị che.
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

      {/* Mặt đất: plane nằm trong group root, không đưa vào bảng tọa độ tòa nhà */}
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
        Ba tòa được mô tả bằng dữ liệu; bảng bên phải hiển thị <strong>tâm world</strong> và{' '}
        <strong>kích thước</strong> từng khối (xem comment trong file).
      </p>

      <label className="three-debug-toggle">
        <input
          type="checkbox"
          checked={showCenterMarkers}
          onChange={(e) => setShowCenterMarkers(e.target.checked)}
        />
        <span>Hiện tâm khối — cầu vàng, luôn trên cùng</span>
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

        <aside className="three-metrics-panel" aria-label="Tọa độ và kích thước khối">
          <h2>Tâm (world) &amp; kích thước</h2>
          {metricRows.map((row, i) => (
            <div key={i} className="metric-block">
              <div className="metric-title">
                {row.towerLabel} — {row.partName}
              </div>
              <table>
                <tbody>
                  <tr>
                    <th>Tâm world</th>
                    <td className="mono">{formatVec3(row.worldCenter)}</td>
                  </tr>
                  <tr>
                    <th>
                      Kích thước
                      <br />
                      <span style={{ fontWeight: 400, opacity: 0.8 }}>rộng×cao×sâu</span>
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
            <strong>Ghi chú:</strong> Trục Y là chiều cao. <em>Tâm world</em> là điểm giữa hình hộp sau
            khi cộng offset gốc <code>ThreeBuildings</code> ({formatVec3(THREE_BUILDINGS_ROOT)}), vị trí
            group từng tòa, và <code>position</code> của mesh. Kích thước trùng{' '}
            <code>boxGeometry args</code>. Checkbox phía trên bật marker tâm từng khối (debug).
          </p>
        </aside>
      </div>
    </div>
  )
}
