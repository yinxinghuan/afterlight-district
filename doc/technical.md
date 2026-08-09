# 《余光街区》技术文档

## 1. 技术栈

- React 18 + TypeScript 5：界面、引导阶段与状态呈现。
- Vite 5：工程化开发与构建，`base: './'`，产物位于 `dist/`，可部署到任意子路径。
- Three.js、React Three Fiber、Drei 与 Three.js Postprocessing：正交等距 3D 街区、GLB 加载、灯光、雾效、分档 GTAO/Bloom、MSAA + SMAA、软阴影和角色骨架节点动画。
- Less：BEM 风格的 `ad-` 前缀界面系统和 390×844、320×568 响应式规则。
- Web Audio API：由振荡器即时合成操作、成功、警报、过载与结算音效，不依赖外部音频文件。

## 2. 目录结构

- `src/App.tsx`：屏幕编排、HUD、角色立绘对话、逐步引导、拖拽上岗、夜袭操作与结算。
- `src/game/useAfterlight.ts`：游戏状态机、资源变化、38 秒防守循环、胜负判定与音效事件。
- `src/game/types.ts`：阶段、资源与快照类型。
- `src/scene/AfterlightScene.tsx`：GLB 清单、无边缘街区搭建、分阶段设施显隐与相机导演、角色动作、场内对白、敌人推进、局部光源、供电线与昼夜灯光。
- `src/i18n/index.ts`：中文/英文检测和文案表。
- `src/audio/sound.ts`：Web Audio 合成器。
- `src/ui/Icons.tsx`：统一线性 SVG 功能图标。
- `public/models/`：经本作需求定义、共享 builder 制作和视觉评审后正式入库的专属 GLB，以及少量合适的背景环境资产。
- `public/portraits/`：从乔、林正式 GLB 离线渲染的 512×512 透明胸像，供对白、战斗通讯和居民身份卡复用。
- `doc/`：需求、视觉、界面、反馈、研究和资产文档。
- `_qa/capture.mjs`：真实浏览器全流程截图、溢出与控制台检查。
- `_qa/portrait-render.html`、`_qa/portrait-render.mjs`、`_qa/render-portraits.mjs`：在透明 Three.js 舞台中加载正式 GLB，以正交相机和三点光批量导出同源角色胸像。

## 3. 核心模块

### 状态管理与主循环

`useAfterlight()` 维护 `intro → rescue-guide → rescuing → assign-guide → assigning → production-proof → repair-guide → dusk → defense → slice-win/slice-fail`。搜救、分工与修复 phase 内部再由界面 beat 区分“理解目标”和“执行动作”，只有真实玩法动作会推进 phase。正确分配先进入 `assigning`，`assignmentProgress` 从 0 到 1 驱动角色转身、三段路径与到岗转向；到达前 `assigned` 保持 false，因此供电、奖励和生产对白都不会提前。救援耗时 3.2 秒；夜袭用 `requestAnimationFrame` 更新 38 秒计时、路障耐久和核心耐久。前 8 秒为缓冲期，路灯过载在第 5 秒解锁，消耗 8 电力并减缓 8 秒压力。

### 屏幕适配与输入

游戏主体以固定全屏容器承载。`CameraDirector` 根据阶段插值相机观察点、观察轴与 zoom，形成建立镜头、救援反打中近景、工作台中景、路障道路中景和夜袭全景；zoom 从旧版 106–118 的教学特写降到 88–94，黄昏/夜战降到 76，使角色、完整目标和道路上下文同时可见。减少动态效果时直接切换。HUD、立绘对话和操作层在 CSS 中独立适配窄屏。即时动作使用 `onPointerDown`；居民卡使用 Pointer Capture 实现拖拽，并保留点击工作台的无障碍/失败恢复入口。入口包含全局 iOS 长按防护，功能触控目标不小于 44×44 CSS px。

教学 UI 采用“卡通街区防线”系统，信息顺序固定为铆钉阶段牌/奶油资源托盘、浅色任务条、角色人物卡和世界目标。`Objective` 只在搜救、分工和修复三个教学状态出现；阶段牌、任务条、人物卡、居民岗位卡、蓝色技能键和奶油成绩牌分别使用不同结构，但共享近 2px 深可可紫描边、1px 内分隔、暖白内高光与 3–5px 短底托。第二轮精修统一了外框/底托厚度、资源图标的分色底章、姓名签、按钮顶部高光、按下位移和禁用层级，去掉会让卡片显得像多层塑料壳的重阴影。状态以天空蓝主行动、叶绿完成和珊瑚红警告共同编码，并保留文字或形状差异。`Dialogue`、居民卡与夜战通讯统一读取 `public/portraits/` 的 GLB 胸像，不再运行时裁切全身预览 PNG。320×568 下将人物卡限制为 126–132px 高，并使用独立的立绘、字号和间距规则，避免通过整页缩放牺牲可读性。

前期与结算信息由 `App.tsx` 的 `guideSequence { phase, beat }` 和 `revealTimers` 驱动。派生 `guideBeat` 只有在序列所属 phase 与当前 game phase 相同时才生效，因此跨步骤首帧必定回到 0。搜救/分工/修复的 beat 0 是场内演出，650ms 后 beat 1 挂载人物卡；`advanceGuide()` 由玩家点击触发 beat 2，人物卡卸载并挂载任务与目标；900ms 后 beat 3 才挂载真实操作。生产 beat 0 只显示 `+3`，850ms 后 beat 1 才加入废料资源与对白；黄昏 beat 0 只展示场景，650ms 后出现守夜卡；结算在 650/1250ms 依次加入统计与重玩。帮助按钮通过递增 `guideReplay` 从当前步骤重播。资源托盘只渲染已解锁项，并用 `data-count` 在 102 / 196 / 286px 三档宽度间扩展。

### 场景、碰撞与更新

当前垂直切片没有自由移动物理碰撞；敌人沿四条明确车道进入路障前的镜头范围，战斗伤害由时间压力模型计算。主场景使用重新入库的 `scene__afterlightTerrain`：一个 15×18u 地基加一块连续草地顶面，消费端保持 1:1；主路、维修支路、前坪和 junction patch 仅以 0.025–0.030u 的表面层嵌入，不再使用独立草台、道路厚板或外露土坡拼接。30×30u 的低矮 `DistrictUnderlay` 只负责极端镜头雾中延伸，不增加交互内容。`scene__signalHouse` 深化为连续基座、主厅、侧翼、双坡屋顶、双檐口、深门框、雨棚、窗台、配电箱和屋顶设备，并保留 `state_signalDoorway / state_signalDoorPivot / state_signalDoor / state_doorBrace / state_doorLatch` 五个正式状态节点。新增 `scene__afterlightWorkshop` 以开放维修口、工具墙、屋顶监视器、行车横梁和吊钩包围工作台；它只在生产阶段后显现。`SignalHouse` 先让斜撑落到 0.18u 基座顶，再绕真实铰链开门；林在进度超过 72% 后才出现在门外安全点。`_qa/capture.mjs` 额外截取 `rescuing-emergence` 状态验证出门帧。正式叙事角色和敌人继续使用 `people__afterlightLin`、`people__afterlightJo`、`monsters__blackoutHusk` 与 `monsters__cableStalker`。角色 GLB 按命名 rig 节点恢复各自 rest pose，再通过 `walk / signal / point / work / shamble / prowl` 动作档案叠加相对关节旋转。`walk` 让腿与对侧手臂反相摆动；外层 group 由 `assignmentPose()` 沿四个路径点移动和转向，内层 group 只负责步态与接地起伏。行走时钟逐帧累计并把单帧推进限制为 100ms：正常 10–60fps 保持 2.8 秒，极低帧率宁可延长也不会从起点跳到终点。`prefers-reduced-motion` 只把行走肢体摆幅归零，外层路径和到岗因果仍保留。

防守更新以真实帧间隔推进，单帧 `dt` 上限为 0.25 秒：低帧率 WebGL 设备上的 38 秒倒计时仍接近墙钟时间，切后台返回时又不会一次累计过量伤害。

### 光照与渲染

场景使用 ACES Filmic tone mapping、白天 1.04/夜间 1.07 exposure 和 sRGB 输出。`EnvironmentLighting` 对低强度环境光、半球光、方向主光、冷 fill 和暖 rim 做阻尼插值：白天主光 2.92，夜间保留 1.78，避免暗色 GLB 被二次压成平面。正式 GLB 默认接收阴影；建筑和设施投射强度 0.36、半径 2.6、2048² 的方向主光软影。人物不投射会横跨画面的长方向影，避免近景出现第二黑色焦点。

`RenderPipeline` 接管每帧渲染，顺序为 `RenderPass → GTAOPass → UnrealBloomPass → OutlinePass → SMAAPass → OutputPass`。`detectQualityTier()` 依据 Save-Data、`deviceMemory`、`hardwareConcurrency` 和设备 DPR 选择 low / balanced / high；对应 DPR 为 1–1.25 / 1–1.6 / 1.5–2，GTAO 为 6 / 9 / 12 samples，MSAA 为 0 / 2 / 4×，阴影为 1024² / 2048² / 2048²。low 关闭 Bloom 但保留 SMAA；balanced/high 的 Bloom 常态强度 0.05–0.08、过载 0.14。`PerformanceGovernor` 使用两个连续 4 秒窗口判断，平均帧率低于 42 FPS 时降一级，降档后冷却 8 秒；页面隐藏或单帧停顿超过 250ms 时不采样，避免切后台误降档。`?render_quality=low|balanced|high` 可在 QA 中锁档，当前解析档位写入 `html[data-render-quality]`。

选择性漫画线通过克隆根节点的 `userData.outlineRole` 标记 `target / actor / landmark`。`RenderPipeline` 在阶段或质量档变化时遍历场景并更新 `OutlinePass.selectedObjects`：low 只选 target，balanced 再选 actor，high 再选 landmark。工作台、路障和中继灯只在对应教学/防守阶段标为 target；Jo、Lin、Husk 与 Stalker 标为 actor；信号屋平时为 landmark、搜救时提升为 target。Outline 使用 `#100E12`、`edgeStrength=1.6`、NormalBlending、无 glow；high / balanced / low 的 thickness 分别为 4 / 3 / 3.2，downsample 分别为 1 / 2 / 2，并位于 Bloom 后、SMAA 前。边缘检测 shader 将遮挡边 alpha 设为 0，避免角色隔墙透视。该过程不会修改 GLB 材质、rig 或门状态节点。

窗口、发电机和中继灯仍由 `LocalLight` 的真实距离衰减照亮附近模型；`SourceHalo` 标出可见光源核心，`GroundLightPool` 只提供更弱的辅助光池。过载阶段两盏灯从暖黄切换为灰青 `#70D4C8`，强度从 13 提升至 18，以 8% 幅度脉冲；同一时刻 `CameraDirector` 产生一次 4.2 zoom 的短推进，`RelayMotes` 显示 12 根短方柱。`PoweredLine` 使用 8 个独立实体段依次改变 emissive。

连续地面的宽幅草面和纵向主路在消费端保留原 GLB 材质，只为跨度至少 4u 的表面克隆材质并叠加一张程序化宏观明度贴图；贴图值差约 6%，没有写实噪点或重复花纹，用来打破整屏单色板而不改变 low-poly 资产身份。

### 音频与多语言

`sound.ts` 在首次用户操作后创建 AudioContext，通过频率、包络和短和弦映射反馈事件；静音状态存入 `afterlight_muted`。`i18n/index.ts` 优先读取 `game_locale`，否则按浏览器语言选择 `zh` 或 `en`，所有玩家可见文案通过 `t()` 输出。

### 存储与平台边界

本实验仅在首次防守胜利时写入 `afterlight_tutorial_complete`，尚未接入排行榜、共享世界或平台存档。`worker/index.js` 只实现正式部署器要求的 `/api/health`，不创建数据库或第二套共享世界；自托管主站与 GitHub Pages 使用同一前端提交和永久 UUID。生产入口保留远程 `guest-shell.js`；QA 的 platform-layout 状态只在测试脚本里隐藏外部访客栏，不修改生产行为。

## 4. 扩展点

- **改玩法数值**：调整 `src/game/useAfterlight.ts` 的初始资源、救援时长、防守时长、压力、技能成本和持续时间。
- **增加经营设施或教学步骤**：先扩展 `src/game/types.ts` 的阶段，再在 `useAfterlight.ts` 添加转换，并在 `App.tsx` 配置唯一主行动与失败恢复。
- **换模型或新增角色**：先经共享 `_lowpoly_lab` 的 builder、评审、catalog、导出和 inventory 同步，再复制正式 GLB，并更新 `AfterlightScene.tsx` 的 `MODEL`、实测比例和 motion profile。
- **改地面或建筑**：在 `_lowpoly_lab/builders/scene.js` 修改 `afterlightTerrain / signalHouse / afterlightWorkshop`，完成真实 WebGL 评审后重新批量导出和同步库存，再复制正式 `scene__*.glb`；禁止在游戏组件里用临时盒子覆盖正式模型。
- **重出角色立绘**：保持正式 GLB 身份不变，调整 `_qa/portrait-render.mjs` 的正交相机、模型朝向和灯光，再运行 `_qa/render-portraits.mjs` 覆盖 `public/portraits/`；不得手工放大模型全身预览图。
- **调整视觉与界面**：场景光照、相机、车道在 `AfterlightScene.tsx`；颜色、间距、响应式和动效在 `styles.less`；设计约束同步更新 `doc/visual.md`。
- **增加后端**：以永久随机 UUID 作为 `session_id` 接入 `@shared/runtime`，将存档、排行榜和事件接口集中封装为独立 hook；GitHub Pages 镜像必须指向自托管绝对 API base。
