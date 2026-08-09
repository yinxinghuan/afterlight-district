import { Html, OrthographicCamera, useGLTF } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import type { GameSnapshot } from '../game/types'
import { t } from '../i18n'

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
type OutlineRole = 'actor' | 'landmark' | 'target'

type QualityTier = 'low' | 'balanced' | 'high'
type QualityConfig = {
  dpr: [number, number]
  gtaoSamples: number
  gtaoBlend: number
  msaaSamples: number
  shadowMapSize: number
  bloom: boolean
  outlineMode: 'targets' | 'actors' | 'full'
  outlineDownsample: number
}

const QUALITY: Record<QualityTier, QualityConfig> = {
  low: { dpr: [1, 1.25], gtaoSamples: 6, gtaoBlend: 0.54, msaaSamples: 0, shadowMapSize: 1024, bloom: false, outlineMode: 'targets', outlineDownsample: 2 },
  balanced: { dpr: [1, 1.6], gtaoSamples: 9, gtaoBlend: 0.68, msaaSamples: 2, shadowMapSize: 2048, bloom: true, outlineMode: 'actors', outlineDownsample: 2 },
  high: { dpr: [1.5, 2], gtaoSamples: 12, gtaoBlend: 0.78, msaaSamples: 4, shadowMapSize: 2048, bloom: true, outlineMode: 'full', outlineDownsample: 1 },
}

function forcedQualityTier(): QualityTier | null {
  if (typeof window === 'undefined') return null
  const value = new URLSearchParams(window.location.search).get('render_quality')
  return value === 'low' || value === 'balanced' || value === 'high' ? value : null
}

function detectQualityTier(): QualityTier {
  const forced = forcedQualityTier()
  if (forced) return forced
  if (typeof navigator === 'undefined' || typeof window === 'undefined') return 'balanced'
  const device = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  const memory = device.deviceMemory
  const cores = device.hardwareConcurrency || 4
  const dpr = window.devicePixelRatio || 1
  if (device.connection?.saveData || (memory !== undefined && memory <= 4) || cores <= 4) return 'low'
  if (dpr >= 2 && cores >= 6 && (memory === undefined || memory >= 6)) return 'high'
  return 'balanced'
}

function downgradeTier(tier: QualityTier): QualityTier {
  return tier === 'high' ? 'balanced' : tier === 'balanced' ? 'low' : 'low'
}

let terrainMacroMap: THREE.CanvasTexture | null = null
function getTerrainMacroMap() {
  if (terrainMacroMap) return terrainMacroMap
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')!
  const wash = context.createLinearGradient(0, 0, 128, 128)
  wash.addColorStop(0, '#ffffff')
  wash.addColorStop(0.46, '#fafcfb')
  wash.addColorStop(1, '#f3f7f5')
  context.fillStyle = wash
  context.fillRect(0, 0, 128, 128)
  context.fillStyle = 'rgba(216, 228, 221, .10)'
  context.beginPath()
  context.moveTo(0, 82)
  context.lineTo(76, 52)
  context.lineTo(128, 70)
  context.lineTo(128, 108)
  context.lineTo(34, 116)
  context.closePath()
  context.fill()
  context.fillStyle = 'rgba(255, 255, 255, .08)'
  context.beginPath()
  context.moveTo(18, 0)
  context.lineTo(94, 0)
  context.lineTo(54, 44)
  context.closePath()
  context.fill()
  terrainMacroMap = new THREE.CanvasTexture(canvas)
  terrainMacroMap.colorSpace = THREE.SRGBColorSpace
  terrainMacroMap.anisotropy = 4
  return terrainMacroMap
}

function Asset({ assetId, scale = 1, outlineRole, ...props }: { assetId: AssetKey; scale?: number | [number, number, number]; outlineRole?: OutlineRole } & JSX.IntrinsicElements['group']) {
  const gltf = useGLTF(MODEL[assetId])
  const clone = useMemo(() => {
    const next = gltf.scene.clone(true)
    const macroMap = assetId === 'terrain' ? getTerrainMacroMap() : null
    next.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return
      const mesh = object as THREE.Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true
      if (macroMap) {
        mesh.geometry.computeBoundingBox()
        const bounds = mesh.geometry.boundingBox
        if (bounds) {
          const size = bounds.getSize(new THREE.Vector3())
          if (Math.max(size.x, size.z) >= 4) {
            const applyMap = (source: THREE.Material) => {
              if (!(source instanceof THREE.MeshStandardMaterial)) return source
              const material = source.clone()
              material.map = macroMap
              material.roughness = 1
              material.needsUpdate = true
              return material
            }
            mesh.material = Array.isArray(mesh.material) ? mesh.material.map(applyMap) : applyMap(mesh.material)
          }
        }
      }
    })
    return next
  }, [assetId, gltf.scene])
  if (outlineRole) clone.userData.outlineRole = outlineRole
  else delete clone.userData.outlineRole
  return <group scale={scale} {...props}><primitive object={clone} /></group>
}

function RiggedAsset({ assetId, motion, active = true, ...props }: { assetId: 'lin' | 'jo' | 'husk' | 'stalker'; motion: 'walk' | 'work' | 'signal' | 'point' | 'shamble' | 'prowl'; active?: boolean } & JSX.IntrinsicElements['group']) {
  const gltf = useGLTF(MODEL[assetId])
  const clone = useMemo(() => {
    const next = gltf.scene.clone(true)
    next.userData.outlineRole = 'actor' satisfies OutlineRole
    next.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return
      const mesh = object as THREE.Mesh
      mesh.castShadow = false
      mesh.receiveShadow = true
    })
    return next
  }, [gltf.scene])
  const root = useRef<THREE.Group>(null)
  const rig = useRef<{ armL?: THREE.Object3D; armR?: THREE.Object3D; legL?: THREE.Object3D; legR?: THREE.Object3D; rest: Record<string, THREE.Euler> } | null>(null)
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    const nodes = {
      armL: clone.getObjectByName('rig_armL'), armR: clone.getObjectByName('rig_armR'),
      legL: clone.getObjectByName('rig_legL'), legR: clone.getObjectByName('rig_legR'),
    }
    rig.current = { ...nodes, rest: Object.fromEntries(Object.entries(nodes).filter(([, n]) => n).map(([key, n]) => [key, n!.rotation.clone()])) }
  }, [clone])

  useFrame(({ clock }) => {
    if (!root.current) return
    const t = clock.elapsedTime
    const speed = motion === 'prowl' ? 7 : motion === 'walk' ? 7.4 : motion === 'shamble' ? 3.2 : motion === 'signal' ? 5.4 : motion === 'work' ? 5.8 : 4.2
    const cycle = Math.sin(t * speed)
    const activeAmount = active && !(reduceMotion && motion === 'walk') ? 1 : 0
    const bob = motion === 'prowl' ? 0.038 : motion === 'walk' ? 0.026 : motion === 'shamble' ? 0.012 : motion === 'work' ? 0.014 : 0.018

    // The inner group owns performance motion. The outer group below owns world
    // placement, so a bob never erases the authored ground height of an actor.
    root.current.position.set(0, Math.abs(cycle) * bob * activeAmount, 0)
    root.current.rotation.x = activeAmount * (motion === 'prowl' ? 0.16 : motion === 'walk' ? -0.035 : motion === 'shamble' ? 0.09 : motion === 'work' ? -0.045 : 0)
    root.current.rotation.z = activeAmount * (motion === 'signal' ? Math.sin(t * 2.7) * 0.035 : motion === 'shamble' ? cycle * 0.018 : 0)

    const current = rig.current
    if (!current) return
    for (const [key, node] of Object.entries(current).filter(([key]) => key !== 'rest') as [string, THREE.Object3D][]) {
      const rest = current.rest[key]
      if (!rest) continue
      const sign = key.endsWith('L') ? 1 : -1
      let xDelta = 0
      let zDelta = 0
      if (active) {
        if (motion === 'prowl') xDelta = cycle * 0.46 * sign
        if (motion === 'walk') xDelta = cycle * (key.startsWith('arm') ? -0.34 : 0.44) * sign * activeAmount
        if (motion === 'shamble') xDelta = cycle * (key.startsWith('arm') ? 0.20 : 0.30) * sign
        if (motion === 'work') xDelta = cycle * (key.startsWith('arm') ? 0.40 : 0.08) * sign
        if (motion === 'signal') xDelta = cycle * 0.10 * sign
        if (motion === 'point') xDelta = cycle * 0.055 * sign
        if (key === 'armR' && motion === 'signal') {
          xDelta = -0.22 + Math.sin(t * speed * 0.72) * 0.12
          zDelta = -1.02 + Math.sin(t * speed) * 0.18
        }
        if (key === 'armR' && motion === 'point') {
          xDelta = -0.18
          zDelta = -0.94
        }
        if (key === 'armL' && motion === 'work') zDelta = 0.08 + cycle * 0.08
        if (key === 'armR' && motion === 'work') zDelta = -0.08 - cycle * 0.08
      }
      node.rotation.x = rest.x + xDelta
      node.rotation.z = rest.z
      node.rotation.z += zDelta
    }
  })

  return <group {...props}><group ref={root}><primitive object={clone} /></group></group>
}

type RestTransform = { position: THREE.Vector3; rotation: THREE.Euler }

function SignalHouse({ game, ...props }: { game: GameSnapshot } & JSX.IntrinsicElements['group']) {
  const gltf = useGLTF(MODEL.signalHouse)
  const clone = useMemo(() => {
    const next = gltf.scene.clone(true)
    next.traverse(object => {
      if (!(object as THREE.Mesh).isMesh) return
      const mesh = object as THREE.Mesh
      mesh.castShadow = true
      mesh.receiveShadow = true
    })
    return next
  }, [gltf.scene])
  const parts = useRef<{
    doorPivot?: THREE.Object3D
    brace?: THREE.Object3D
    rest: Record<'doorPivot' | 'brace', RestTransform | undefined>
  } | null>(null)
  const openness = useRef(0)

  useEffect(() => {
    const doorPivot = clone.getObjectByName('state_signalDoorPivot')
    const brace = clone.getObjectByName('state_doorBrace')
    const capture = (node?: THREE.Object3D): RestTransform | undefined => node ? {
      position: node.position.clone(),
      rotation: node.rotation.clone(),
    } : undefined
    parts.current = {
      doorPivot,
      brace,
      rest: { doorPivot: capture(doorPivot), brace: capture(brace) },
    }
  }, [clone])

  useFrame((_, delta) => {
    const current = parts.current
    if (!current) return
    const target = game.rescued ? 1 : game.phase === 'rescuing' ? Math.min(0.94, game.rescueProgress) : 0
    openness.current = THREE.MathUtils.damp(openness.current, target, game.phase === 'rescuing' ? 7 : 11, delta)
    const smooth = (value: number) => value * value * (3 - 2 * value)
    const braceProgress = smooth(THREE.MathUtils.clamp(openness.current / 0.52, 0, 1))
    const doorProgress = smooth(THREE.MathUtils.clamp((openness.current - 0.50) / 0.50, 0, 1))

    if (current.doorPivot && current.rest.doorPivot) {
      current.doorPivot.position.copy(current.rest.doorPivot.position)
      current.doorPivot.rotation.copy(current.rest.doorPivot.rotation)
      current.doorPivot.rotation.y -= 1.18 * doorProgress
    }
    if (current.brace && current.rest.brace) {
      current.brace.position.copy(current.rest.brace.position)
      current.brace.rotation.copy(current.rest.brace.rotation)
      current.brace.position.x -= 0.18 * braceProgress
      current.brace.position.y -= 0.38 * braceProgress
      current.brace.position.z += 0.08 * braceProgress
      current.brace.rotation.z -= 0.90 * braceProgress
    }
  })

  clone.userData.outlineRole = (game.phase === 'rescue-guide' || game.phase === 'rescuing' ? 'target' : 'landmark') satisfies OutlineRole

  return <group {...props}><primitive object={clone} /></group>
}

const CAMERA_BY_PHASE: Record<GameSnapshot['phase'], { target: [number, number, number]; zoom: number; offset?: [number, number, number] }> = {
  intro: { target: [-0.84, 0.42, -1.44], zoom: 80, offset: [9.5, 11.5, 10.5] },
  'rescue-guide': { target: [-2.72, 0.58, -2.48], zoom: 88, offset: [-7, 9, 6] },
  rescuing: { target: [-2.76, 0.60, -2.52], zoom: 92, offset: [-7, 9, 6] },
  'assign-guide': { target: [-1.70, 0.50, -0.02], zoom: 90, offset: [7.5, 8.6, 9.5] },
  assigning: { target: [-2.10, 0.50, -0.72], zoom: 91, offset: [7.5, 8.6, 9.5] },
  'production-proof': { target: [-1.02, 0.5, -0.22], zoom: 94, offset: [7.5, 8.2, 9.5] },
  'repair-guide': { target: [0, 0.44, 3.18], zoom: 88, offset: [9.5, 8.2, 11.5] },
  repairing: { target: [-0.12, 0.44, 2.18], zoom: 86, offset: [9.5, 8.2, 11.5] },
  'day-brief': { target: [0, 0.40, 0.68], zoom: 76, offset: [9.5, 8.8, 11.5] },
  dusk: { target: [0, 0.38, 0.62], zoom: 76, offset: [9.5, 8.8, 11.5] },
  defense: { target: [0, 0.36, 1.62], zoom: 76, offset: [10.5, 7.8, 12.5] },
  'slice-win': { target: [0, 0.36, 0.35], zoom: 82, offset: [9.5, 8.6, 11.5] },
  'slice-fail': { target: [0, 0.36, 1.42], zoom: 82, offset: [10.5, 7.6, 12.5] },
}

function CameraDirector({ game }: { game: GameSnapshot }) {
  const { camera } = useThree()
  const look = useRef(new THREE.Vector3(0, 0.3, 0))
  const overdriveImpulse = useRef(0)
  const wasOverdrive = useRef(false)
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useFrame((_, delta) => {
    const shot = CAMERA_BY_PHASE[game.phase]
    const overdrive = game.phase === 'defense' && game.overdriveUntil > game.defenseElapsed
    if (overdrive && !wasOverdrive.current && !reduceMotion) overdriveImpulse.current = 1
    wasOverdrive.current = overdrive
    overdriveImpulse.current = THREE.MathUtils.damp(overdriveImpulse.current, 0, 3.4, delta)
    const target = new THREE.Vector3(...shot.target)
    const desired = target.clone().add(new THREE.Vector3(...(shot.offset ?? [8, 10, 8])))
    const alpha = reduceMotion ? 1 : 1 - Math.exp(-delta * 5.2)
    camera.position.lerp(desired, alpha)
    look.current.lerp(target, alpha)
    camera.lookAt(look.current)
    const ortho = camera as THREE.OrthographicCamera
    const impactZoom = overdriveImpulse.current * 4.2
    ortho.zoom = THREE.MathUtils.lerp(ortho.zoom, shot.zoom + impactZoom, alpha)
    ortho.updateProjectionMatrix()
  })
  return null
}

function EnvironmentLighting({ night, powered, shadowMapSize }: { night: boolean; powered: boolean; shadowMapSize: number }) {
  const ambient = useRef<THREE.AmbientLight>(null)
  const hemisphere = useRef<THREE.HemisphereLight>(null)
  const key = useRef<THREE.DirectionalLight>(null)
  const fill = useRef<THREE.DirectionalLight>(null)
  const rim = useRef<THREE.DirectionalLight>(null)

  useFrame((_, delta) => {
    if (ambient.current) ambient.current.intensity = THREE.MathUtils.damp(ambient.current.intensity, night ? 0.055 : 0.08, 3.8, delta)
    if (hemisphere.current) hemisphere.current.intensity = THREE.MathUtils.damp(hemisphere.current.intensity, night ? 0.22 : 0.32, 3.8, delta)
    if (key.current) key.current.intensity = THREE.MathUtils.damp(key.current.intensity, night ? 1.78 : 2.92, 3.8, delta)
    if (fill.current) fill.current.intensity = THREE.MathUtils.damp(fill.current.intensity, night ? 0.09 : 0.14, 3.8, delta)
    if (rim.current) rim.current.intensity = THREE.MathUtils.damp(rim.current.intensity, powered ? 0.34 : 0.22, 4.6, delta)
  })

  return (
    <>
      <ambientLight ref={ambient} intensity={0.08} color="#91a5ad" />
      <hemisphereLight ref={hemisphere} args={['#d6e8ec', '#493d34', 0.32]} />
      <directionalLight
        ref={key}
        position={[8, 14, 10]}
        intensity={2.92}
        color="#eef7fa"
        castShadow
        shadow-mapSize={[shadowMapSize, shadowMapSize]}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={1}
        shadow-camera-far={36}
        shadow-intensity={0.36}
        shadow-radius={2.6}
        shadow-bias={-0.00035}
        shadow-normalBias={0.025}
      />
      <directionalLight ref={fill} position={[-9, 5, -3]} intensity={0.14} color="#dfe8ff" />
      <directionalLight ref={rim} position={[-7, 8, -10]} intensity={0.22} color="#ffd8a0" />
    </>
  )
}

function RenderPipeline({ game, quality }: { game: GameSnapshot; quality: QualityConfig }) {
  const { gl, scene, camera, size } = useThree()
  const pipeline = useMemo(() => {
    const composer = new EffectComposer(gl)
    const maxSamples = gl.capabilities.isWebGL2 ? gl.capabilities.maxSamples : 0
    const samples = Math.min(quality.msaaSamples, maxSamples)
    composer.renderTarget1.samples = samples
    composer.renderTarget2.samples = samples
    const renderPass = new RenderPass(scene, camera)
    const gtao = new GTAOPass(scene, camera, size.width, size.height)
    gtao.output = GTAOPass.OUTPUT.Default
    gtao.blendIntensity = quality.gtaoBlend
    gtao.updateGtaoMaterial({
      radius: 0.42,
      distanceExponent: 1,
      thickness: 1,
      scale: 1.02,
      samples: quality.gtaoSamples,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    })
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: quality.gtaoSamples })
    const bloom = new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.18, 0.42, 0.88)
    bloom.enabled = quality.bloom
    const outline = new OutlinePass(new THREE.Vector2(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio()), scene, camera)
    outline.edgeStrength = 1.6
    outline.edgeGlow = 0
    outline.edgeThickness = quality.outlineMode === 'full' ? 4 : quality.outlineMode === 'actors' ? 3 : 3.2
    outline.downSampleRatio = quality.outlineDownsample
    outline.visibleEdgeColor.set('#100e12')
    outline.hiddenEdgeColor.set('#ffffff')
    // OutlinePass is designed to show both visible and occluded glow edges.
    // Replace only its edge output so occluded selections remain transparent;
    // otherwise actors can acquire comic lines through buildings.
    outline.edgeDetectionMaterial.fragmentShader = outline.edgeDetectionMaterial.fragmentShader.replace(
      /vec3 edgeColor = [^;]+;\s*gl_FragColor = vec4\(edgeColor, 1\.0\) \* vec4\(d\);/,
      'float visible = 1.0 - step(0.999, visibilityFactor);\n gl_FragColor = vec4(visibleEdgeColor, visible) * vec4(d);',
    )
    outline.edgeDetectionMaterial.needsUpdate = true
    outline.overlayMaterial.blending = THREE.NormalBlending
    outline.enabled = false
    const smaa = new SMAAPass(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
    const output = new OutputPass()
    composer.addPass(renderPass)
    composer.addPass(gtao)
    composer.addPass(bloom)
    composer.addPass(outline)
    composer.addPass(smaa)
    composer.addPass(output)
    return { composer, gtao, bloom, outline, smaa }
  }, [camera, gl, quality, scene])

  useEffect(() => {
    pipeline.composer.setSize(size.width, size.height)
    pipeline.gtao.setSize(size.width, size.height)
    pipeline.bloom.setSize(size.width, size.height)
    pipeline.outline.setSize(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
    pipeline.smaa.setSize(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio())
  }, [gl, pipeline, size.height, size.width])

  useEffect(() => () => pipeline.composer.dispose(), [pipeline])

  useEffect(() => {
    const selected: THREE.Object3D[] = []
    scene.traverse(object => {
      const role = object.userData.outlineRole as OutlineRole | undefined
      if (!role) return
      const selectedForTier = role === 'target' || quality.outlineMode === 'full' || (quality.outlineMode === 'actors' && role === 'actor')
      if (selectedForTier) selected.push(object)
    })
    pipeline.outline.selectedObjects = selected
    pipeline.outline.enabled = selected.length > 0
  }, [game.phase, pipeline, quality.outlineMode, scene])

  const overdrive = game.phase === 'defense' && game.overdriveUntil > game.defenseElapsed
  pipeline.bloom.strength = quality.bloom ? (overdrive ? 0.14 : game.phase === 'dusk' || game.phase === 'defense' ? 0.08 : 0.05) : 0
  pipeline.bloom.threshold = overdrive ? 0.92 : 0.96
  pipeline.bloom.radius = overdrive ? 0.42 : 0.30

  useFrame((_, delta) => {
    const night = ['dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)
    gl.toneMappingExposure = THREE.MathUtils.damp(gl.toneMappingExposure, night ? 1.07 : 1.04, 4.2, delta)
    pipeline.composer.render(delta)
  }, 1)

  return null
}

function PerformanceGovernor({ tier, locked, onDowngrade }: { tier: QualityTier; locked: boolean; onDowngrade: () => void }) {
  const elapsed = useRef(0)
  const frames = useRef(0)
  const slowWindows = useRef(0)
  const cooldown = useRef(2)

  useFrame((_, delta) => {
    if (locked || tier === 'low' || document.visibilityState !== 'visible') return
    cooldown.current = Math.max(0, cooldown.current - delta)
    if (cooldown.current > 0 || delta > 0.25) return
    elapsed.current += Math.min(delta, 0.1)
    frames.current += 1
    if (elapsed.current < 4) return
    const fps = frames.current / elapsed.current
    slowWindows.current = fps < 42 ? slowWindows.current + 1 : 0
    elapsed.current = 0
    frames.current = 0
    if (slowWindows.current < 2) return
    slowWindows.current = 0
    cooldown.current = 8
    onDowngrade()
  })
  return null
}

function PoweredLine({ active, overdrive }: { active: boolean; overdrive: boolean }) {
  const materials = useRef<Array<THREE.MeshStandardMaterial | null>>([])
  useFrame(({ clock }) => {
    materials.current.forEach((material, index) => {
      if (!material) return
      const wave = (Math.sin(clock.elapsedTime * (overdrive ? 8 : 4.5) - index * 0.92) + 1) / 2
      material.emissiveIntensity = active ? (overdrive ? 0.9 + wave * 0.9 : 0.28 + wave * 0.62) : 0.02
    })
  })
  return (
    <group position={[0.1, 0.36, 0.18]} rotation={[0, -0.48, 0]}>
      {Array.from({ length: 8 }, (_, index) => (
        <mesh key={index} position={[0, 0, -2.5 + index * 0.72]}>
          <boxGeometry args={[0.09, 0.035, 0.48]} />
          <meshStandardMaterial
            ref={material => { materials.current[index] = material }}
            color={active ? '#287f78' : '#25323b'}
            emissive="#3fb6ac"
            emissiveIntensity={active ? 0.42 : 0.02}
          />
        </mesh>
      ))}
    </group>
  )
}

function useGlowTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 128
    const context = canvas.getContext('2d')!
    const gradient = context.createRadialGradient(64, 64, 2, 64, 64, 62)
    gradient.addColorStop(0, 'rgba(255,255,255,0.92)')
    gradient.addColorStop(0.42, 'rgba(255,255,255,0.38)')
    gradient.addColorStop(1, 'rgba(255,255,255,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])

  useEffect(() => () => texture.dispose(), [texture])
  return texture
}

function GroundLightPool({ position, color, size, opacity }: { position: [number, number, number]; color: string; size: [number, number]; opacity: number }) {
  const texture = useGlowTexture()

  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </mesh>
  )
}

function SourceHalo({ position, color, size, opacity }: { position: [number, number, number]; color: string; size: number; opacity: number }) {
  const texture = useGlowTexture()
  return (
    <sprite position={position} scale={[size, size, size]} renderOrder={3}>
      <spriteMaterial map={texture} color={color} transparent opacity={opacity} depthWrite={false} blending={THREE.AdditiveBlending} />
    </sprite>
  )
}

function LocalLight({ position, color, intensity, distance, pulse = 0 }: { position: [number, number, number]; color: string; intensity: number; distance: number; pulse?: number }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }, delta) => {
    if (!light.current) return
    const target = intensity * (1 + Math.sin(clock.elapsedTime * 8.5) * pulse)
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, target, 5.5, delta)
  })
  return <pointLight ref={light} position={position} color={color} intensity={0} distance={distance} decay={2} />
}

function RelayMotes({ active }: { active: boolean }) {
  const group = useRef<THREE.Group>(null)
  const reduceMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  const seeds = useMemo(() => Array.from({ length: 12 }, (_, index) => ({
    lamp: index % 2,
    phase: ((index * 37) % 100) / 100,
    radius: 0.13 + (index % 3) * 0.07,
    speed: 0.52 + (index % 4) * 0.09,
  })), [])

  useFrame(({ clock }) => {
    if (!group.current || !active || reduceMotion) return
    group.current.children.forEach((child, index) => {
      const seed = seeds[index]
      const progress = (clock.elapsedTime * seed.speed + seed.phase) % 1
      const side = seed.lamp === 0 ? -2.22 : 2.30
      child.position.set(
        side + Math.sin((progress + seed.phase) * Math.PI * 2) * seed.radius,
        1.18 + progress * 0.96,
        2.05 + Math.cos((progress + seed.phase) * Math.PI * 2) * seed.radius,
      )
      child.scale.y = 0.55 + (1 - progress) * 0.65
    })
  })

  return (
    <group ref={group} visible={active && !reduceMotion}>
      {seeds.map((_, index) => (
        <mesh key={index}>
          <boxGeometry args={[0.025, 0.10, 0.025]} />
          <meshBasicMaterial color="#9ce7df" transparent opacity={0.72} />
        </mesh>
      ))}
    </group>
  )
}

function DistrictUnderlay() {
  const macroMap = getTerrainMacroMap()
  return (
    <>
      <mesh position={[0, 0.10, 0]} receiveShadow>
        <boxGeometry args={[80, 0.20, 80]} />
        <meshStandardMaterial color="#17301f" roughness={1} metalness={0} />
      </mesh>
      {/* The authored terrain is a 15 x 18 slab whose bevel used to read as the
          edge of a tabletop. Continue its grass surface beneath the roads and
          props so every directed camera shot sees an unbounded district. */}
      <mesh position={[0, 0.482, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 80]} />
        <meshStandardMaterial color="#24501f" map={macroMap} roughness={1} metalness={0} />
      </mesh>
    </>
  )
}

function Enemy({ index, kind, game }: { index: number; kind: 'husk' | 'stalker'; game: GameSnapshot }) {
  const group = useRef<THREE.Group>(null)
  const laneX = [-2.45, -0.82, 0.82, 2.45][index % 4]
  const waveRow = Math.floor(index / 4)
  useFrame(() => {
    if (!group.current || game.phase !== 'defense') return
    const slowed = game.overdriveUntil > game.defenseElapsed
    const nightMultiplier = 1 + (game.day - 1) * 0.11
    const speed = (kind === 'stalker' ? 0.42 : 0.31) * nightMultiplier * (slowed ? 0.42 : 1)
    const travel = Math.max(0, game.defenseElapsed * speed - waveRow * 1.25)
    // Keep the whole first wave in the playable camera volume. They advance from
    // the road edge and stack at the barricade instead of silently looping off-map.
    const z = 5.35 - Math.min(1.82, travel * 1.45)
    const x = laneX * (1 - Math.min(0.08, travel * 0.025))
    group.current.position.set(x, 0.2, z)
  })
  return <group ref={group} visible={game.phase === 'defense'}><RiggedAsset assetId={kind} motion={kind === 'stalker' ? 'prowl' : 'shamble'} scale={kind === 'stalker' ? 0.46 : 0.42} /></group>
}

const ASSIGN_PATH: ReadonlyArray<readonly [number, number, number]> = [
  [-0.25, 0.38, 1.15],
  [-0.55, 0.40, 0.75],
  [-0.98, 0.44, 0.34],
  [-1.50, 0.48, 0.00],
]

const ASSIGN_SEGMENT_LENGTHS = ASSIGN_PATH.slice(1).map((point, index) => {
  const previous = ASSIGN_PATH[index]
  return Math.hypot(point[0] - previous[0], point[2] - previous[2])
})
const ASSIGN_PATH_LENGTH = ASSIGN_SEGMENT_LENGTHS.reduce((sum, length) => sum + length, 0)

function easeInOut(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

function lerpAngle(from: number, to: number, amount: number) {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + delta * amount
}

function sampleAssignPath(progress: number) {
  let distance = THREE.MathUtils.clamp(progress, 0, 1) * ASSIGN_PATH_LENGTH
  for (let index = 0; index < ASSIGN_SEGMENT_LENGTHS.length; index += 1) {
    const length = ASSIGN_SEGMENT_LENGTHS[index]
    if (distance <= length || index === ASSIGN_SEGMENT_LENGTHS.length - 1) {
      const amount = THREE.MathUtils.clamp(distance / length, 0, 1)
      const from = ASSIGN_PATH[index]
      const to = ASSIGN_PATH[index + 1]
      return {
        position: [
          THREE.MathUtils.lerp(from[0], to[0], amount),
          THREE.MathUtils.lerp(from[1], to[1], amount),
          THREE.MathUtils.lerp(from[2], to[2], amount),
        ] as [number, number, number],
        rotation: Math.atan2(to[0] - from[0], to[2] - from[2]),
      }
    }
    distance -= length
  }
  return { position: [...ASSIGN_PATH[ASSIGN_PATH.length - 1]] as [number, number, number], rotation: 0.8 }
}

function assignmentPose(progress: number) {
  const turnEnd = 0.115
  const walkEnd = 0.865
  const firstHeading = sampleAssignPath(0).rotation
  const finalHeading = sampleAssignPath(0.999).rotation
  if (progress <= turnEnd) {
    return {
      position: [...ASSIGN_PATH[0]] as [number, number, number],
      rotation: lerpAngle(2.2, firstHeading, easeInOut(progress / turnEnd)),
    }
  }
  if (progress < walkEnd) {
    const travel = easeInOut((progress - turnEnd) / (walkEnd - turnEnd))
    return sampleAssignPath(travel)
  }
  return {
    position: [...ASSIGN_PATH[ASSIGN_PATH.length - 1]] as [number, number, number],
    rotation: lerpAngle(finalHeading, 0.8, easeInOut((progress - walkEnd) / (1 - walkEnd))),
  }
}

const REPAIR_PATH: ReadonlyArray<readonly [number, number, number]> = [
  [-1.50, 0.48, 0.00],
  [-1.34, 0.44, 0.72],
  [-0.72, 0.39, 1.62],
  [0.52, 0.34, 2.78],
]
const REPAIR_SEGMENT_LENGTHS = REPAIR_PATH.slice(1).map((point, index) => {
  const previous = REPAIR_PATH[index]
  return Math.hypot(point[0] - previous[0], point[2] - previous[2])
})
const REPAIR_PATH_LENGTH = REPAIR_SEGMENT_LENGTHS.reduce((sum, length) => sum + length, 0)

function sampleRepairPath(progress: number) {
  let distance = THREE.MathUtils.clamp(progress, 0, 1) * REPAIR_PATH_LENGTH
  for (let index = 0; index < REPAIR_SEGMENT_LENGTHS.length; index += 1) {
    const length = REPAIR_SEGMENT_LENGTHS[index]
    if (distance <= length || index === REPAIR_SEGMENT_LENGTHS.length - 1) {
      const amount = THREE.MathUtils.clamp(distance / length, 0, 1)
      const from = REPAIR_PATH[index]
      const to = REPAIR_PATH[index + 1]
      return {
        position: [
          THREE.MathUtils.lerp(from[0], to[0], amount),
          THREE.MathUtils.lerp(from[1], to[1], amount),
          THREE.MathUtils.lerp(from[2], to[2], amount),
        ] as [number, number, number],
        rotation: Math.atan2(to[0] - from[0], to[2] - from[2]),
      }
    }
    distance -= length
  }
  return { position: [...REPAIR_PATH[REPAIR_PATH.length - 1]] as [number, number, number], rotation: 0.08 }
}

function repairPose(progress: number) {
  const turnEnd = 0.09
  const walkEnd = 0.75
  const firstHeading = sampleRepairPath(0).rotation
  const finalHeading = sampleRepairPath(0.999).rotation
  if (progress <= turnEnd) {
    return {
      position: [...REPAIR_PATH[0]] as [number, number, number],
      rotation: lerpAngle(0.8, firstHeading, easeInOut(progress / turnEnd)),
      walking: false,
    }
  }
  if (progress < walkEnd) {
    const travel = easeInOut((progress - turnEnd) / (walkEnd - turnEnd))
    return { ...sampleRepairPath(travel), walking: true }
  }
  return {
    position: [...REPAIR_PATH[REPAIR_PATH.length - 1]] as [number, number, number],
    rotation: lerpAngle(finalHeading, 0.08, easeInOut((progress - walkEnd) / (1 - walkEnd))),
    walking: false,
  }
}

function District({ game, quality, guideBeat }: { game: GameSnapshot; quality: QualityConfig; guideBeat: number }) {
  const powered = game.assigned || ['repair-guide', 'repairing', 'day-brief', 'dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)
  const overdrive = game.overdriveUntil > game.defenseElapsed
  const night = ['dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)
  const productionVisible = ['assign-guide', 'assigning', 'production-proof', 'repair-guide', 'repairing', 'day-brief', 'dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)
  const defenseVisible = ['repair-guide', 'repairing', 'day-brief', 'dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)
  const rescueShot = game.phase === 'rescue-guide' || game.phase === 'rescuing'
  const linEmerging = game.phase === 'rescuing' && game.rescueProgress > 0.72
  const showLin = game.rescued || linEmerging
  const linAssignmentPose = assignmentPose(game.assignmentProgress)
  const linRepairPose = repairPose(game.repairProgress)
  const linAtBarricade = ['repairing', 'day-brief', 'dusk', 'defense', 'slice-win', 'slice-fail'].includes(game.phase)

  return (
    <>
      <color attach="background" args={[night ? '#0b1118' : '#111821']} />
      <fog attach="fog" args={[night ? '#0b1118' : '#111821', 13, 26]} />
      <EnvironmentLighting night={night} powered={powered} shadowMapSize={quality.shadowMapSize} />

      <group position={[0, -0.15, 0.3]} rotation={[0, -0.1, 0]}>
        <DistrictUnderlay />
        <Asset assetId="terrain" />
        <Asset assetId="ridge" position={[1.88, 0.38, -6.32]} />
        <SignalHouse game={game} position={[-3.24, 0.48, -3.78]} scale={0.74} />
        <LocalLight position={[-3.22, 1.10, -3.00]} color="#ffd58a" intensity={night ? 11 : 7} distance={3.8} pulse={0.025} />
        <SourceHalo position={[-3.22, 1.10, -3.00]} color="#ffd58a" size={0.88} opacity={night ? 0.48 : 0.34} />
        <GroundLightPool position={[-3.22, 0.51, -2.78]} color="#ffd58a" size={[2.8, 1.9]} opacity={night ? 0.17 : 0.10} />
        {productionVisible && <>
          <PoweredLine active={powered} overdrive={overdrive} />
          <Asset assetId="workshop" position={[-2.72, 0.48, -0.92]} scale={0.74} />
          <Asset assetId="generator" position={[0, 0.32, -2.12]} scale={1.08} />
          <Asset assetId="workbench" outlineRole={game.phase === 'assign-guide' || game.phase === 'assigning' || game.phase === 'production-proof' ? 'target' : undefined} position={[-2.30, 0.48, 0.20]} rotation={[0, 0.35, 0]} scale={0.88} />
          <LocalLight position={[0, 1.16, -2.06]} color="#55c8bd" intensity={powered ? 7 : 0.5} distance={3.0} pulse={0.035} />
          <SourceHalo position={[0, 1.16, -2.06]} color="#55c8bd" size={0.64} opacity={powered ? 0.34 : 0.06} />
          <GroundLightPool position={[0, 0.38, -1.94]} color="#55c8bd" size={[2.5, 1.8]} opacity={powered ? 0.11 : 0.02} />
        </>}
        {defenseVisible && <>
          <Asset assetId="barricade" outlineRole={game.phase === 'repair-guide' || game.phase === 'repairing' ? 'target' : undefined} position={[0, 0.32, 3.42]} rotation={[0, 0.02, 0]} scale={[1.62 + (game.barricadeMax - 100) * 0.008, 1, 1]} />
          <Asset assetId="relayLamp" outlineRole={game.phase === 'defense' ? 'target' : undefined} position={[-2.22, 0.48, 2.02]} scale={0.68} />
          <Asset assetId="relayLamp" outlineRole={game.phase === 'defense' ? 'target' : undefined} position={[2.30, 0.38, 2.12]} rotation={[0, Math.PI, 0]} scale={0.68} />
          <LocalLight position={[-2.22, 1.56, 2.02]} color={overdrive ? '#70d4c8' : '#ffd58a'} intensity={overdrive ? 18 : 13} distance={4.0} pulse={overdrive ? 0.08 : 0.02} />
          <LocalLight position={[2.30, 1.48, 2.12]} color={overdrive ? '#70d4c8' : '#ffd58a'} intensity={overdrive ? 18 : 13} distance={4.0} pulse={overdrive ? 0.08 : 0.02} />
          <SourceHalo position={[-2.22, 1.56, 2.02]} color={overdrive ? '#70d4c8' : '#ffd58a'} size={overdrive ? 0.82 : 0.72} opacity={0.42} />
          <SourceHalo position={[2.30, 1.48, 2.12]} color={overdrive ? '#70d4c8' : '#ffd58a'} size={overdrive ? 0.82 : 0.72} opacity={0.42} />
          <GroundLightPool position={[-2.22, 0.52, 2.02]} color={overdrive ? '#70d4c8' : '#ffd58a'} size={[3.5, 2.6]} opacity={overdrive ? 0.14 : 0.12} />
          <GroundLightPool position={[2.30, 0.42, 2.12]} color={overdrive ? '#70d4c8' : '#ffd58a'} size={[3.5, 2.6]} opacity={overdrive ? 0.14 : 0.12} />
          <RelayMotes active={overdrive} />
        </>}

        <RiggedAsset
          assetId="jo"
          motion={game.phase === 'rescuing' ? 'work' : rescueShot || ['repair-guide', 'dusk', 'defense'].includes(game.phase) ? 'point' : 'signal'}
          position={game.phase === 'rescuing' ? [-4.38, 0.48, -2.18] : rescueShot ? [-4.66, 0.48, -1.28] : [2.05, 0.38, 1.88]}
          scale={0.34}
          rotation={[0, game.phase === 'rescuing' ? 0.76 : rescueShot ? 0.52 : game.phase === 'repair-guide' ? -0.15 : 2.55, 0]}
        />
        {showLin && <RiggedAsset
          assetId="lin"
          motion={linEmerging ? 'signal' : game.phase === 'assigning' ? 'walk' : game.phase === 'repairing' ? linRepairPose.walking ? 'walk' : 'work' : linAtBarricade ? game.phase === 'defense' ? 'work' : 'point' : game.assigned ? 'work' : 'point'}
          active
          position={linEmerging ? [-2.72, 0.48, -2.30] : game.phase === 'assigning' ? linAssignmentPose.position : game.phase === 'repairing' ? linRepairPose.position : linAtBarricade ? [...REPAIR_PATH[REPAIR_PATH.length - 1]] : game.assigned ? [-1.50, 0.48, 0.00] : [...ASSIGN_PATH[0]]}
          scale={0.35}
          rotation={[0, linEmerging ? -1.15 : game.phase === 'assigning' ? linAssignmentPose.rotation : game.phase === 'repairing' ? linRepairPose.rotation : linAtBarricade ? 0.08 : game.assigned ? 0.8 : 2.2, 0]}
        />}
        {Array.from({ length: 8 + (game.day - 1) * 4 }, (_, index) => <Enemy key={index} index={index} kind={index % Math.max(3, 7 - game.day) === 0 ? 'stalker' : 'husk'} game={game} />)}

        {game.phase === 'rescue-guide' && guideBeat === 0 && <Html position={[-3.24, 1.92, -3.16]} center><span className="ad-world-speech">{t('workerHelp')}</span></Html>}
        {game.phase === 'rescue-guide' && guideBeat >= 2 && <Html position={[-3.24, 2.18, -3.78]} center distanceFactor={8}><span className="ad-world-ping" /></Html>}
        {game.phase === 'assign-guide' && guideBeat >= 2 && <Html position={[-2.30, 1.55, 0.20]} center distanceFactor={8}><span className="ad-world-ping ad-world-ping--teal" /></Html>}
        {game.phase === 'repair-guide' && guideBeat >= 2 && <Html position={[0, 1.3, 3.42]} center distanceFactor={8}><span className="ad-world-ping ad-world-ping--danger" /></Html>}
      </group>
    </>
  )
}

export function AfterlightScene({ game, guideBeat }: { game: GameSnapshot; guideBeat: number }) {
  const forcedTier = useMemo(forcedQualityTier, [])
  const [tier, setTier] = useState<QualityTier>(detectQualityTier)
  const quality = QUALITY[tier]

  useEffect(() => {
    document.documentElement.dataset.renderQuality = tier
    return () => { delete document.documentElement.dataset.renderQuality }
  }, [tier])

  return (
    <Canvas shadows dpr={quality.dpr} gl={{ antialias: true, alpha: false, powerPreference: tier === 'low' ? 'low-power' : 'high-performance' }} onCreated={({ gl }) => {
      gl.toneMapping = THREE.ACESFilmicToneMapping
      gl.toneMappingExposure = 1.04
      gl.outputColorSpace = THREE.SRGBColorSpace
    }}>
      <OrthographicCamera makeDefault position={[8, 10, 8]} zoom={88} near={0.1} far={100} onUpdate={camera => camera.lookAt(0, 0.35, 0.15)} />
      <CameraDirector game={game} />
      <Suspense fallback={null}><District game={game} quality={quality} guideBeat={guideBeat} /></Suspense>
      <RenderPipeline game={game} quality={quality} />
      <PerformanceGovernor tier={tier} locked={forcedTier !== null} onDowngrade={() => setTier(current => downgradeTier(current))} />
    </Canvas>
  )
}

Object.values(MODEL).forEach(url => useGLTF.preload(url))
