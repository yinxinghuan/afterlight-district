import fs from 'node:fs/promises'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import * as THREE from 'three'

const path = new URL('../public/models/scene__signalHouse.glb', import.meta.url)
const bytes = await fs.readFile(path)
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject))
const required = ['state_signalDoorway', 'state_signalDoorPivot', 'state_signalDoor', 'state_doorBrace', 'state_doorLatch']
const report = required.map(name => {
  const node = gltf.scene.getObjectByName(name)
  return {
    name,
    found: !!node,
    position: node?.position.toArray(),
    rotation: node?.rotation.toArray().slice(0, 3),
  }
})

const missing = report.filter(item => !item.found).map(item => item.name)
const pivot = gltf.scene.getObjectByName('state_signalDoorPivot')
const brace = gltf.scene.getObjectByName('state_doorBrace')
const pivotRest = pivot?.rotation.clone()
const bracePosition = brace?.position.clone()
const braceRotation = brace?.rotation.clone()
const smooth = value => value * value * (3 - 2 * value)
const states = [0, 0.5, 1].map(progress => {
  const braceProgress = smooth(THREE.MathUtils.clamp(progress / 0.52, 0, 1))
  const doorProgress = smooth(THREE.MathUtils.clamp((progress - 0.50) / 0.50, 0, 1))
  pivot.rotation.copy(pivotRest)
  pivot.rotation.y -= 1.18 * doorProgress
  brace.position.copy(bracePosition)
  brace.rotation.copy(braceRotation)
  brace.position.x -= 0.18 * braceProgress
  brace.position.y -= 0.38 * braceProgress
  brace.position.z += 0.08 * braceProgress
  brace.rotation.z -= 0.90 * braceProgress
  gltf.scene.updateMatrixWorld(true)
  const braceBounds = new THREE.Box3().setFromObject(brace)
  return {
    progress,
    doorRotationY: pivot.rotation.y,
    braceMinY: braceBounds.min.y,
    braceMaxY: braceBounds.max.y,
  }
})
const finalBraceGrounded = states[2].braceMinY >= 0.16 && states[2].braceMinY <= 0.20
const staged = Math.abs(states[1].doorRotationY) < 0.01 && states[1].braceMaxY < states[0].braceMaxY - 0.40 && states[1].braceMinY >= 0.16
const ok = missing.length === 0 && finalBraceGrounded && staged
console.log(JSON.stringify({ ok, missing, finalBraceGrounded, staged, report, states }, null, 2))
if (!ok) process.exitCode = 1
