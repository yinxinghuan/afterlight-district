import { Html, OrthographicCamera, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { enemyPosition, fireAt, interact, overdriveActive, step, subscribe, world } from './world'

const MODEL = {
  lin: './models/people__afterlightLin.glb',
  jo: './models/people__afterlightJo.glb',
  husk: './models/monsters__blackoutHusk.glb',
  stalker: './models/monsters__cableStalker.glb',
  signalHouse: './models/scene__signalHouse.glb',
  workshop: './models/scene__afterlightWorkshop.glb',
  terrain: './models/scene__afterlightTerrain.glb',
  ridge: './models/scene__afterlightRidge.glb',
  relayLamp: './models/scene__relayLamp.glb',
  generator: './models/scene__generator.glb',
  workbench: './models/scene__workbench.glb',
  barricade: './models/scene__barricade.glb',
} as const

type AssetKey = keyof typeof MODEL
type Motion = 'walk' | 'work' | 'signal' | 'point' | 'shamble' | 'prowl'

function scenery(night: boolean) {
  const powered = world.assigned || world.preview || ['repair', 'repairing', 'dusk', 'night', 'dawn', 'upgrade', 'fail'].includes(world.phase)
  const lamps = powered || world.preview || ['repair', 'repairing', 'dusk', 'night', 'dawn', 'upgrade', 'fail'].includes(world.phase)
  return { night, powered, lamps, overdrive: overdriveActive() }
}

function moodNight() {
  return world.preview || ['title', 'dusk', 'night', 'dawn', 'upgrade', 'fail'].includes(world.phase)
}

function Asset({ assetId, scale = 1, ...props }: { assetId: AssetKey; scale?: number | [number, number, number] } & JSX.IntrinsicElements['group']) {
  const gltf = useGLTF(MODEL[assetId])
  const clone = useMemo(() => {
    const next = gltf.scene.clone(true)
    next.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return next
  }, [gltf.scene])
  return <group scale={scale} {...props}><primitive object={clone} /></group>
}

function RiggedAsset({ assetId, motion, active = true, ...props }: { assetId: 'lin' | 'jo' | 'husk' | 'stalker'; motion: Motion; active?: boolean } & JSX.IntrinsicElements['group']) {
  const gltf = useGLTF(MODEL[assetId])
  const clone = useMemo(() => {
    const next = gltf.scene.clone(true)
    next.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = false
      mesh.receiveShadow = true
    })
    return next
  }, [gltf.scene])
  const root = useRef<THREE.Group>(null)
  const rig = useRef<{ armL?: THREE.Object3D; armR?: THREE.Object3D; legL?: THREE.Object3D; legR?: THREE.Object3D; rest: Record<string, THREE.Euler> } | null>(null)

  useEffect(() => {
    const nodes = {
      armL: clone.getObjectByName('rig_armL'),
      armR: clone.getObjectByName('rig_armR'),
      legL: clone.getObjectByName('rig_legL'),
      legR: clone.getObjectByName('rig_legR'),
    }
    rig.current = {
      ...nodes,
      rest: Object.fromEntries(Object.entries(nodes).filter((entry): entry is [string, THREE.Object3D] => !!entry[1]).map(([key, node]) => [key, node.rotation.clone()])),
    }
  }, [clone])

  useFrame(({ clock }) => {
    if (!root.current) return
    const live = assetId === 'jo' || assetId === 'lin' ? actorMotion(assetId) : motion
    const t = clock.elapsedTime
    const speed = live === 'prowl' ? 7 : live === 'walk' ? 7.4 : live === 'shamble' ? 3.2 : live === 'signal' ? 5.4 : live === 'work' ? 5.8 : 4.2
    const cycle = Math.sin(t * speed)
    const amount = active ? 1 : 0
    const bob = live === 'prowl' ? 0.038 : live === 'walk' ? 0.026 : live === 'shamble' ? 0.012 : live === 'work' ? 0.014 : 0.018
    root.current.position.set(0, Math.abs(cycle) * bob * amount, 0)
    root.current.rotation.x = amount * (live === 'prowl' ? 0.16 : live === 'walk' ? -0.035 : live === 'shamble' ? 0.09 : live === 'work' ? -0.045 : 0)
    const current = rig.current
    if (!current) return
    const parts: Array<[string, THREE.Object3D | undefined]> = [['armL', current.armL], ['armR', current.armR], ['legL', current.legL], ['legR', current.legR]]
    for (const [key, node] of parts) {
      const rest = current.rest[key]
      if (!node || !rest) continue
      const sign = key.endsWith('L') ? 1 : -1
      let xDelta = 0
      let zDelta = 0
      if (active) {
        if (live === 'prowl') xDelta = cycle * 0.46 * sign
        if (live === 'walk') xDelta = cycle * (key.startsWith('arm') ? -0.34 : 0.44) * sign
        if (live === 'shamble') xDelta = cycle * (key.startsWith('arm') ? 0.2 : 0.3) * sign
        if (live === 'work') xDelta = cycle * (key.startsWith('arm') ? 0.4 : 0.08) * sign
        if (live === 'signal') xDelta = cycle * 0.1 * sign
        if (live === 'point') xDelta = cycle * 0.055 * sign
        if (key === 'armR' && (live === 'signal' || live === 'point')) {
          xDelta = live === 'signal' ? -0.22 : -0.18
          zDelta = live === 'signal' ? -1.02 : -0.94
        }
      }
      node.rotation.x = rest.x + xDelta
      node.rotation.z = rest.z + zDelta
    }
  })

  return <group {...props}><group ref={root}><primitive object={clone} /></group></group>
}

function SignalHouse(props: JSX.IntrinsicElements['group']) {
  const gltf = useGLTF(MODEL.signalHouse)
  const clone = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  const parts = useRef<{ door?: THREE.Object3D; brace?: THREE.Object3D; doorRest?: THREE.Euler; bracePos?: THREE.Vector3; braceRot?: THREE.Euler } | null>(null)
  const open = useRef(0)

  useEffect(() => {
    const door = clone.getObjectByName('state_signalDoorPivot')
    const brace = clone.getObjectByName('state_doorBrace')
    parts.current = {
      door, brace,
      doorRest: door?.rotation.clone(),
      bracePos: brace?.position.clone(),
      braceRot: brace?.rotation.clone(),
    }
    clone.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
  }, [clone])

  useFrame((_, delta) => {
    const current = parts.current
    if (!current?.door || !current.doorRest || !current.brace || !current.bracePos || !current.braceRot) return
    const target = world.rescued ? 1 : world.phase === 'rescuing' ? Math.min(0.94, world.rescueT) : 0
    open.current = THREE.MathUtils.damp(open.current, target, 7, delta)
    const smooth = open.current * open.current * (3 - 2 * open.current)
    const braceProgress = THREE.MathUtils.clamp(smooth / 0.52, 0, 1)
    const doorProgress = THREE.MathUtils.clamp((smooth - 0.5) / 0.5, 0, 1)
    current.door.rotation.copy(current.doorRest)
    current.door.rotation.y -= 1.18 * doorProgress
    current.brace.position.copy(current.bracePos)
    current.brace.rotation.copy(current.braceRot)
    current.brace.position.x -= 0.18 * braceProgress
    current.brace.position.y -= 0.38 * braceProgress
    current.brace.rotation.z -= 0.9 * braceProgress
  })

  return <group {...props}><primitive object={clone} /></group>
}

const ASSIGN: Array<[number, number, number]> = [[-0.25, 0.38, 1.15], [-0.55, 0.4, 0.75], [-0.98, 0.44, 0.34], [-1.5, 0.48, 0]]
const REPAIR: Array<[number, number, number]> = [[-1.5, 0.48, 0], [-1.34, 0.44, 0.72], [-0.72, 0.39, 1.62], [0.52, 0.34, 2.78]]

function samplePath(path: Array<[number, number, number]>, progress: number) {
  const lengths = path.slice(1).map((point, index) => Math.hypot(point[0] - path[index][0], point[2] - path[index][2]))
  const total = lengths.reduce((sum, length) => sum + length, 0)
  let distance = THREE.MathUtils.clamp(progress, 0, 1) * total
  for (let index = 0; index < lengths.length; index += 1) {
    const length = lengths[index]
    if (distance <= length || index === lengths.length - 1) {
      const amount = length === 0 ? 1 : THREE.MathUtils.clamp(distance / length, 0, 1)
      const from = path[index]
      const to = path[index + 1]
      return {
        position: [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount, from[2] + (to[2] - from[2]) * amount] as [number, number, number],
        rotation: Math.atan2(to[0] - from[0], to[2] - from[2]),
      }
    }
    distance -= length
  }
  return { position: path[path.length - 1], rotation: 0 }
}

function actorMotion(assetId: 'jo' | 'lin'): Motion {
  if (assetId === 'jo') {
    if (world.phase === 'rescuing') return 'work'
    if (world.phase === 'rescue' || world.phase === 'night' || world.phase === 'dusk') return 'point'
    return 'signal'
  }
  if (world.phase === 'assigning' || (world.phase === 'repairing' && world.repairT < 0.78)) return 'walk'
  if (world.phase === 'night' || world.phase === 'repairing') return 'work'
  return 'point'
}

function ActorRig() {
  const jo = useRef<THREE.Group>(null)
  const lin = useRef<THREE.Group>(null)
  useFrame(() => {
    if (jo.current) {
      const rescue = world.phase === 'rescue' || world.phase === 'rescuing'
      const spot = world.phase === 'rescuing' ? [-4.2, 0.48, -2.05] : rescue ? [-4.55, 0.48, -1.3] : [1.85, 0.38, 1.72]
      jo.current.position.set(spot[0], spot[1], spot[2])
      jo.current.rotation.y = rescue ? 0.55 : 2.45
    }
    if (!lin.current) return
    const show = world.rescued || (world.phase === 'rescuing' && world.rescueT > 0.62)
    lin.current.visible = show
    if (!show) return
    let position: [number, number, number] = [-2.72, 0.48, -2.3]
    let rotation = -1.1
    if (world.phase === 'assign') {
      position = ASSIGN[0]
      rotation = 2.2
    } else if (world.phase === 'assigning') {
      const pose = samplePath(ASSIGN, world.assignT)
      position = pose.position
      rotation = pose.rotation
    } else if (world.phase === 'repair') {
      position = [-1.5, 0.48, 0]
      rotation = 0.8
    } else if (world.phase === 'repairing') {
      const pose = samplePath(REPAIR, world.repairT)
      position = pose.position
      rotation = pose.rotation
    } else if (show && world.phase !== 'rescuing') {
      position = [0.52, 0.34, 2.78]
      rotation = 0.1
    }
    lin.current.position.set(position[0], position[1], position[2])
    lin.current.rotation.y = rotation
  })
  return (
    <>
      <group ref={jo}><RiggedAsset assetId="jo" motion={world.phase === 'rescuing' ? 'work' : world.phase === 'rescue' ? 'point' : 'signal'} scale={0.34} /></group>
      <group ref={lin} visible={false}><RiggedAsset assetId="lin" motion="point" scale={0.35} /></group>
    </>
  )
}

function EnemySlot({ index }: { index: number }) {
  const ref = useRef<THREE.Group>(null)
  const husk = useRef<THREE.Group>(null)
  const stalker = useRef<THREE.Group>(null)
  const bar = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const enemy = world.enemies[index]
    if (!ref.current) return
    if (!enemy || enemy.hp <= 0) {
      ref.current.visible = false
      return
    }
    ref.current.visible = true
    const [x, y, z] = enemyPosition(enemy)
    ref.current.position.set(x, y, z)
    ref.current.rotation.y = enemy.lane === 0 ? 2.5 : -2.5
    const scale = enemy.kind === 'brute' ? 1.28 : 1
    ref.current.scale.setScalar(scale * (1 + enemy.flash * 0.35))
    if (husk.current) husk.current.visible = enemy.kind !== 'stalker'
    if (stalker.current) stalker.current.visible = enemy.kind === 'stalker'
    if (bar.current) {
      const ratio = Math.max(0.05, enemy.hp / enemy.maxHp)
      bar.current.scale.x = ratio
      bar.current.position.x = (ratio - 1) * 0.32
      bar.current.visible = ratio < 0.98
      const material = bar.current.material as THREE.MeshBasicMaterial
      material.color.set(enemy.kind === 'stalker' ? '#ffb15a' : '#ff6d62')
    }
  })
  return (
    <group ref={ref} visible={false}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        const enemy = world.enemies[index]
        if (!enemy) return
        const [x, , z] = enemyPosition(enemy)
        world.firing = true
        fireAt(x, z)
      }}
    >
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[0.7, 1.3, 0.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <group ref={husk}><RiggedAsset assetId="husk" motion="shamble" scale={0.42} /></group>
      <group ref={stalker}><RiggedAsset assetId="stalker" motion="prowl" scale={0.46} /></group>
      <mesh ref={bar} position={[0, 1.55, 0]}>
        <boxGeometry args={[0.64, 0.06, 0.04]} />
        <meshBasicMaterial color="#ff6d62" />
      </mesh>
    </group>
  )
}

function SparkField() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const color = useMemo(() => new THREE.Color(), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    const count = 80
    for (let i = 0; i < count; i += 1) {
      const spark = world.sparks[i]
      if (!spark) {
        dummy.position.set(0, -10, 0)
        dummy.scale.setScalar(0)
      } else {
        dummy.position.set(spark.x, spark.y, spark.z)
        dummy.scale.setScalar(0.07 * spark.size * (spark.life / spark.max))
        color.set(spark.color)
        mesh.setColorAt(i, color)
      }
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  return <instancedMesh ref={ref} args={[geo, mat, 80]} />
}

function Beams() {
  const lines = useMemo(() => Array.from({ length: 8 }, () => {
    const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)])
    const material = new THREE.LineBasicMaterial({ color: '#e9fff8', transparent: true, blending: THREE.AdditiveBlending, toneMapped: false })
    const line = new THREE.Line(geometry, material)
    line.visible = false
    line.frustumCulled = false
    return line
  }), [])
  useFrame(() => {
    lines.forEach((line, index) => {
      const beam = world.beams[index]
      if (!beam) {
        line.visible = false
        return
      }
      line.visible = true
      const position = line.geometry.attributes.position as THREE.BufferAttribute
      position.setXYZ(0, beam.x1, beam.y1, beam.z1)
      position.setXYZ(1, beam.x2, beam.y2, beam.z2)
      position.needsUpdate = true
      ;(line.material as THREE.LineBasicMaterial).opacity = beam.life / beam.max
    })
  })
  return <>{lines.map((line, index) => <primitive key={index} object={line} />)}</>
}

function Floats() {
  const { camera, size } = useThree()
  const group = useRef<THREE.Group>(null)
  const vec = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const root = document.getElementById('cg-floats')
    const origin = group.current
    if (!root || !origin) return
    const kids = root.children
    for (let i = 0; i < kids.length; i += 1) {
      const el = kids[i] as HTMLDivElement
      const popup = world.popups[i]
      if (!popup) {
        el.hidden = true
        continue
      }
      el.hidden = false
      vec.set(popup.x, popup.y, popup.z)
      origin.localToWorld(vec)
      vec.project(camera)
      const x = (vec.x * 0.5 + 0.5) * size.width
      const y = (-vec.y * 0.5 + 0.5) * size.height
      el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
      el.style.opacity = String(Math.min(1, popup.life * 4))
      if (el.textContent !== popup.text) el.textContent = popup.text
      el.style.color = popup.color
    }
  })
  return <group ref={group} />
}

function useGlow() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62)
    gradient.addColorStop(0, 'rgba(255,255,255,0.9)')
    gradient.addColorStop(0.45, 'rgba(255,255,255,0.28)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
}

function Pool({ position, color, size, opacity }: { position: [number, number, number]; color: string; size: [number, number]; opacity: number }) {
  const map = useGlow()
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function Halo({ position, color, size, opacity }: { position: [number, number, number]; color: string; size: number; opacity: number }) {
  const map = useGlow()
  return (
    <sprite position={position} scale={[size, size, size]} renderOrder={3}>
      <spriteMaterial map={map} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  )
}

function District() {
  const rev = useSyncExternalStore(subscribe, () => world.rev)
  void rev
  const group = useRef<THREE.Group>(null)
  const night = moodNight()
  const { powered, lamps, overdrive } = scenery(night)
  const lampColor = overdrive ? '#7ee7dc' : '#ffd58a'
  const showDefense = world.phase !== 'title' || world.preview
  const ping = world.phase === 'rescue' ? 'house' : world.phase === 'assign' ? 'bench' : world.phase === 'repair' ? 'barricade' : ''
  return (
    <group ref={group} position={[0, -0.15, 0.3]} rotation={[0, -0.08, 0]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <boxGeometry args={[80, 0.2, 80]} />
        <meshStandardMaterial color="#17301f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.482, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#24501f" roughness={1} />
      </mesh>
      <mesh position={[0, 0.6, 0]} rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => {
          event.stopPropagation()
          if (!group.current) return
          const local = group.current.worldToLocal(event.point.clone())
          const near = (x: number, z: number, radius: number) => Math.hypot(local.x - x, local.z - z) < radius
          if (world.phase === 'rescue' && near(-3.24, -3.5, 2.8)) { interact('house'); return }
          if (world.phase === 'assign' && near(-2.2, 0.2, 2.2)) { interact('bench'); return }
          if (world.phase === 'repair' && near(0, 3.35, 2.6)) { interact('barricade'); return }
          if (world.phase !== 'night') return
          world.firing = true
          world.aim = { x: local.x, z: local.z }
          fireAt(local.x, local.z)
        }}
        onPointerMove={(event: ThreeEvent<PointerEvent>) => {
          if (world.phase !== 'night' || !group.current) return
          const local = group.current.worldToLocal(event.point.clone())
          world.aim = { x: local.x, z: local.z }
        }}
      >
        <planeGeometry args={[30, 24]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Asset assetId="terrain" />
      <Asset assetId="ridge" position={[1.88, 0.38, -6.32]} />
      <SignalHouse position={[-3.24, 0.48, -3.78]} scale={0.74} />
      <mesh position={[-3.24, 1.2, -3.4]}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); interact('house') }}
      >
        <boxGeometry args={[2.4, 2.1, 2.2]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Halo position={[-3.22, 1.15, -3.0]} color="#ffd58a" size={0.9} opacity={night ? 0.5 : 0.32} />
      <Pool position={[-3.22, 0.52, -2.7]} color="#ffd58a" size={[2.8, 1.9]} opacity={night ? 0.16 : 0.1} />
      <pointLight position={[-3.22, 1.15, -3]} color="#ffd58a" intensity={night ? 12 : 7} distance={4.2} decay={2} />

      <Asset assetId="workshop" position={[-2.72, 0.48, -0.92]} scale={0.74} />
      <Asset assetId="generator" position={[0, 0.32, -2.12]} scale={1.08} />
      <Asset assetId="workbench" position={[-2.3, 0.48, 0.2]} rotation={[0, 0.35, 0]} scale={0.88} />
      <mesh position={[-2.15, 0.9, 0.15]}
        onPointerDown={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); interact('bench') }}
      >
        <boxGeometry args={[1.8, 1.2, 1.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <Halo position={[0, 1.2, -2.02]} color="#55c8bd" size={0.7} opacity={powered ? 0.4 : 0.08} />
      <Pool position={[0, 0.4, -1.9]} color="#55c8bd" size={[2.6, 1.8]} opacity={powered ? 0.12 : 0.02} />
      <pointLight position={[0, 1.2, -2]} color="#55c8bd" intensity={powered ? 8 : 0.6} distance={3.4} decay={2} />

      {showDefense && <>
        <Asset assetId="barricade" position={[0, 0.32, 3.42]} scale={[Math.min(2.4, 1.55 + (world.barricadeMax - 100) * 0.01), 1, 1]} />
        <mesh position={[0, 0.8, 3.35]}
          onPointerDown={(event: ThreeEvent<PointerEvent>) => { event.stopPropagation(); interact('barricade') }}
        >
          <boxGeometry args={[2.6, 1.1, 1.1]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Asset assetId="relayLamp" position={[-2.22, 0.48, 2.02]} scale={0.68} />
        <Asset assetId="relayLamp" position={[2.3, 0.38, 2.12]} rotation={[0, Math.PI, 0]} scale={0.68} />
        <pointLight position={[-2.22, 1.56, 2.02]} color={lampColor} intensity={lamps ? overdrive ? 20 : 13 : 0.2} distance={4.4} decay={2} />
        <pointLight position={[2.3, 1.48, 2.12]} color={lampColor} intensity={lamps ? overdrive ? 20 : 13 : 0.2} distance={4.4} decay={2} />
        <Halo position={[-2.22, 1.56, 2.02]} color={lampColor} size={overdrive ? 0.9 : 0.72} opacity={lamps ? 0.46 : 0.05} />
        <Halo position={[2.3, 1.48, 2.12]} color={lampColor} size={overdrive ? 0.9 : 0.72} opacity={lamps ? 0.46 : 0.05} />
        <Pool position={[-2.22, 0.52, 2.02]} color={lampColor} size={[3.6, 2.5]} opacity={lamps ? overdrive ? 0.2 : 0.13 : 0.02} />
        <Pool position={[2.3, 0.42, 2.12]} color={lampColor} size={[3.6, 2.5]} opacity={lamps ? overdrive ? 0.2 : 0.13 : 0.02} />
      </>}

      <ActorRig />
      {Array.from({ length: 12 }, (_, index) => <EnemySlot key={index} index={index} />)}
      <SparkField />
      <Beams />
      <Floats />
      {ping === 'house' && <Html position={[-3.24, 2.25, -3.5]} center zIndexRange={[2, 0]}><span className="cg-ping" /></Html>}
      {ping === 'bench' && <Html position={[-2.2, 1.7, 0.15]} center zIndexRange={[2, 0]}><span className="cg-ping cg-ping--teal" /></Html>}
      {ping === 'barricade' && <Html position={[0, 1.55, 3.4]} center zIndexRange={[2, 0]}><span className="cg-ping cg-ping--danger" /></Html>}
      {world.phase === 'rescue' && <Html position={[-3.15, 2.05, -2.7]} center zIndexRange={[2, 0]}><span className="cg-speech">Anyone there? The door is jammed!</span></Html>}
    </group>
  )
}

function CameraRig() {
  const look = useRef(new THREE.Vector3(0.1, 0.42, 0.35))
  const desired = useMemo(() => new THREE.Vector3(), [])
  const { camera, size } = useThree()
  useFrame((_, delta) => {
    if (world.phase === 'rescue' || world.phase === 'rescuing') desired.set(-0.85, 0.48, -0.55)
    else if (world.phase === 'assign' || world.phase === 'assigning') desired.set(-0.45, 0.45, 0.05)
    else if (world.phase === 'repair' || world.phase === 'repairing') desired.set(0.05, 0.42, 0.7)
    else desired.set(0.12, 0.4, 0.45)
    const k = 1 - Math.exp(-2.6 * delta)
    look.current.lerp(desired, k)
    const ortho = camera as THREE.OrthographicCamera
    const zoom = Math.min(size.width / 15.4, size.height / 8.55)
    const next = zoom * (1 + (world.reduceMotion ? 0 : world.punch))
    ortho.zoom = THREE.MathUtils.damp(ortho.zoom || next, next, 5, delta)
    ortho.near = -50
    ortho.far = 90
    ortho.updateProjectionMatrix()
    const amp = world.reduceMotion ? 0 : world.shake * 0.18
    camera.position.set(look.current.x + 11.2 + (Math.random() - 0.5) * amp, 9.5 + (Math.random() - 0.5) * amp * 0.45, look.current.z + 12.5)
    camera.lookAt(look.current.x, 0.4, look.current.z)
  })
  return null
}

function Lights() {
  const night = moodNight()
  return (
    <>
      <color attach="background" args={[night ? '#0c141c' : '#121b24']} />
      <fog attach="fog" args={[night ? '#0c141c' : '#121b24', 18, 36]} />
      <ambientLight intensity={night ? 0.28 : 0.36} color="#c5d2df" />
      <hemisphereLight args={['#d7e4f2', '#1a2a22', night ? 0.42 : 0.55]} />
      <directionalLight
        position={[9, 16, 8]}
        intensity={night ? 1.85 : 2.55}
        color={night ? '#d5deea' : '#fff6e8'}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.00035}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={1}
        shadow-camera-far={42}
      />
      <directionalLight position={[-8, 6, -4]} intensity={0.22} color="#d7e4ff" />
      <directionalLight position={[-6, 8, -10]} intensity={0.28} color="#ffd7a4" />
    </>
  )
}

function Pipeline() {
  const { gl, scene, camera, size } = useThree()
  const bloom = useRef<UnrealBloomPass | null>(null)
  const composer = useMemo(() => {
    const instance = new EffectComposer(gl)
    instance.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.08, 0.34, 0.86)
    bloom.current = bloomPass
    instance.addPass(bloomPass)
    instance.addPass(new SMAAPass(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio()))
    instance.addPass(new OutputPass())
    return instance
  }, [camera, gl, scene, size.height, size.width])

  useEffect(() => () => composer.dispose(), [composer])

  useFrame((_, delta) => {
    if (bloom.current) {
      bloom.current.strength = overdriveActive() ? 0.18 : world.phase === 'dawn' ? 0.11 : 0.075
    }
    const night = moodNight()
    const target = world.phase === 'dawn' || world.phase === 'upgrade' ? 1.18 : night ? 1.06 : 1.1
    gl.toneMappingExposure = THREE.MathUtils.damp(gl.toneMappingExposure, target, 3.2, delta)
    composer.render()
  }, 1)
  return null
}

function Runner() {
  useFrame((_, delta) => {
    step(Math.min(0.1, delta))
  })
  return null
}

export default function GuestScene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: false, alpha: false, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.06
        gl.outputColorSpace = THREE.SRGBColorSpace
        gl.setClearColor('#0c141c')
      }}
      onPointerUp={() => { world.firing = false }}
      onPointerLeave={() => { world.firing = false }}
    >
      <OrthographicCamera makeDefault position={[11, 10, 13]} zoom={78} near={-50} far={90} onUpdate={camera => camera.lookAt(0.1, 0.4, 0.4)} />
      <CameraRig />
      <Lights />
      <Suspense fallback={null}>
        <District />
      </Suspense>
      <Runner />
      <Pipeline />
    </Canvas>
  )
}

Object.values(MODEL).forEach(url => useGLTF.preload(url))
