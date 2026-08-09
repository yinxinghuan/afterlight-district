# Afterlight District

一款竖屏 3D 生存经营垂直切片：跟随人物演出逐步救援居民、分配生产任务，并在入夜后守住刚刚恢复供电的街区。

- 正式主站：发布后使用永久 session UUID 地址
- GitHub Pages：`https://yinxinghuan.github.io/afterlight-district/`
- 技术组件：React、Three.js、React Three Fiber 与 Drei（MIT，完整 notice 见 `public/THIRD_PARTY_NOTICES.txt`）
- 3D 资产：为本作在内部 low-poly builder 中制作或从同一内部资产库复用，并按正式 inventory 身份导出

## Development

```bash
npm ci
npm run dev
npm run build
```

构建产物使用相对资源路径，可同时部署在任意子路径和 GitHub Pages。
