import fs from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

for (const id of ['Jo', 'Lin']) {
  const path = new URL(`../public/models/people__afterlight${id}.glb`, import.meta.url)
  const bytes = await fs.readFile(path)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const gltf = await new Promise((resolve, reject) => new GLTFLoader().parse(buffer, '', resolve, reject))
  const bounds = new THREE.Box3().setFromObject(gltf.scene)
  const size = bounds.getSize(new THREE.Vector3())
  const center = bounds.getCenter(new THREE.Vector3())
  console.log(JSON.stringify({ id, min: bounds.min.toArray(), max: bounds.max.toArray(), size: size.toArray(), center: center.toArray() }))
}
