import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)])
const files = walk('dist')
const list = files.map(file => `${crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}  ${file.slice(5)}`).sort().join('\n') + '\n'
const hash = crypto.createHash('sha256').update(list).digest('hex')
fs.mkdirSync('output/playwright', { recursive: true })
fs.writeFileSync(`output/playwright/host-${process.argv[2] ?? 'after'}.sha256`, list)
console.log({ files: files.length, hash })
if (files.length !== 34 || hash !== 'be742b1ea74c4b6ad35c1df9d5c7f6f8243ec548fcb929f30bb1145260a72371') process.exitCode = 1
