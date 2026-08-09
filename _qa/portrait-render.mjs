import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

const who = new URLSearchParams(location.search).get('who') === 'lin' ? 'Lin' : 'Jo'
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true })
renderer.setSize(512, 512, false)
renderer.setPixelRatio(1)
renderer.setClearColor(0x000000, 0)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08
document.body.append(renderer.domElement)

const scene = new THREE.Scene()
scene.add(new THREE.HemisphereLight(0xf4fbff, 0x5a4b3e, 0.58))
const key = new THREE.DirectionalLight(0xffffff, 3.15)
key.position.set(5.5, 8, 7)
scene.add(key)
const fill = new THREE.DirectionalLight(0xb9d8e7, 0.38)
fill.position.set(-6, 3, 2)
scene.add(fill)
const rim = new THREE.DirectionalLight(0xffdfaa, 0.46)
rim.position.set(-4, 5, -7)
scene.add(rim)

const camera = new THREE.OrthographicCamera(-1.28, 1.28, 1.28, -1.28, 0.1, 30)
camera.position.set(4.6, 3.4, 6.6)
camera.lookAt(0, 1.98, 0)

const model = await new GLTFLoader().loadAsync(`/models/people__afterlight${who}.glb`)
model.scene.traverse(object => {
  if (!(object instanceof THREE.Mesh)) return
  object.castShadow = false
  object.receiveShadow = false
})
model.scene.rotation.y = who === 'Jo' ? -0.06 : 0.06
scene.add(model.scene)
renderer.render(scene, camera)
window.__PORTRAIT_READY__ = true
