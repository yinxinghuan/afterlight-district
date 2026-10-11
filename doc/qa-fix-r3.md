# Afterlight District 游客版 — R3 修复验收

日期：2026-10-11。按用户确认的 `afterlight-codex-fix-paste.md` 执行。
起点：`1044f182c5db97beaf8c28a0d2b57a0ecdf4ac2a`，分支 `cursor/crazygames-guest-9e58`，草稿 PR #1。
受众和语言沿用原游客版：国际桌面玩家，虚构停电街区，Lin / Jo，英文、16:9、键鼠。没有新增内容、引擎、资产、SDK、账号或广告。

## 修复与边界

1. 第 03 步：场景路障上方提供 210×68 CSS px 的真实 DOM 按钮，明确 `10 scrap · click or press E`。保留原 3D 点击及 E 交互，阶段守卫避免 PointerDown / 键盘激活重复扣费。场景建立独立堆叠上下文，Html 层不会覆盖 HUD 的 Skip；Skip / 静音最小 44px。所有静止教学步骤和动作播放阶段都验证可跳过。
2. 时间：删除 Runner 的每帧 0.1s 截断。正常和慢帧均按不超过 0.05s 的子步积分完整 delta；最多回补 10s 的详细模拟，超出部分仍偿还昼夜倒计时债务。命中短停不再暂停夜间时间。没有改夜长、伤害、波次和升级数值。
3. 标题：每次 load 先进入 title。有进行中的存档时保留为 pending run，显示 Continue；点击才恢复。标题停留或切换静音不会覆盖这份存档；无存档显示 Play。Enter / Space 聚焦按钮时只交给按钮，避免一次 Enter 同时 Continue 和重开。静音按钮置于标题遮罩上方并固定在右端。

原始构建的纯净 `?fresh=1` 本次本就显示标题；确定复现的绕过路径是 load 直接恢复进行中的存档。第三步 Skip 失效在本机原始构建未复现，不把推测写成已证实根因；修复增加了明确目标并隔离层级，覆盖六个教学阶段。

## 自动化与真实浏览器

- `npm ci --no-audit --no-fund`：使用原 lockfile，未改依赖。
- `npm run build`、`npm run build:guest`：通过。原有大 chunk / 非模块 storage 脚本构建提示仍存在。
- `node --test src/guest/world.test.mjs`：3/3，通过 fresh / Continue / mute 存档保护、修复只扣 10、六阶段 Skip，以及 60fps、2fps、0.2fps、hit-stop 和 15s 停顿计时。单位测试直接操作模拟状态，不作为真实试玩证据。
- `_qa/verify-fix-r3.mjs`：通过 Playwright CLI 操作实际 `dist-guest/`（4196 端口），不注入资源或改 world 状态。鼠标路障、E 修复均从步骤 01、02、03 到 dusk；额外完整路径进入 night 1。六个阶段分别鼠标 Skip；第 03 步 Escape 也可跳过。
- 保存后重新普通访问：Continue；标题停留和静音前后 run JSON 完全相同；聚焦 Continue 按 Enter 恢复 night，不重开。
- 正常帧率额外按住 Space 开火、按 1 过载：11s 左右仍为 night，存档已记录 5 kills、lampSteady=true、85 barricade、100 core。命中数字、废料奖励、灯光/按钮反馈可见。这是功能和事件反馈检查，不代表真人手感验收。
- 页面异常和 console error：最终主回归均为 0。

计时采用存档自动更新样本的模拟时间差与 `performance.now()` 时间差比较；HUD 整秒向上取整另允许 1 秒显示量化误差。主回归窗口 800×450：

| 状态 | 实测帧率 | 真实时间差 | 模拟时间差 | 偏差 |
|---|---:|---:|---:|---:|
| 正常 | 59.07 FPS | 8.0599s | 8.0498s | 0.125% |
| DevTools CPU 6× | 41.67 FPS | 8.0398s | 8.0357s | 0.051% |
| QA 帧调度限制 | 1.90 FPS | 8.0997s | 8.1043s | 0.057% |

均小于 10%。QA 的帧限制只存在于浏览器 harness，生产不识别 `qa_lowfps`；这是慢帧模拟，不冒称已经测试真实无 GPU 硬件。最终仅追加静音右对齐 CSS，计时逻辑未变；最终 CSS 对三档标题及教学重新截图验证。

## 宿主逐字节证明

在相同 lockfile、同一工作目录构建改前和改后宿主。清单格式为 `sha256  相对 dist 路径`，对完整清单行排序后加末尾换行再计算 SHA256。

- 改前：34 文件，`be742b1ea74c4b6ad35c1df9d5c7f6f8243ec548fcb929f30bb1145260a72371`
- 改后：34 文件，`be742b1ea74c4b6ad35c1df9d5c7f6f8243ec548fcb929f30bb1145260a72371`
- `cmp output/playwright/host-before.sha256 output/playwright/host-after.sha256`：相同，0 个文件差异。

| 文件 | 改前 = 改后 SHA256 |
|---|---|
| `dist/index.html` | `bcbbd1fd68ca8554cab8d19e43ec9291e638f2038b27c89500c639f3a43617c6` |
| `dist/assets/index-BNn6posN.js` | `da9e44d515dccc12c26da514c29fda17436c9fc9a281b3d231839cf168083e6d` |
| `dist/assets/index-HljGuxYb.css` | `729ccb4070996e1fff71cda04f7bb4819a65d84036f6b48e9498799a689f81f4` |

重算：`node _qa/hash-host-r3.mjs after`。完整 before / after 清单和浏览器 JSON 随截图分支发布。宿主源文件、宿主资源、配置和 master 全未修改；原本脏的宿主工作目录也未切分支或清理。

## 视觉证据与复验

使用 game-visual-qa / ui-foundation：增加明确的路障大目标、独立层级、44px 控件，并在目视发现标题静音压暗后提升其层级、右对齐，再截图。

本地证据：`output/playwright/`。远程：同仓库 `cg-screens-afterlight` 分支。

- 原始第三步：`before-repair-800x450.png`。
- 三档标题：`after-title-800x450.png`、`after-title-907x510.png`、`after-title-1920x1080.png`。
- 800×450：`after-repair-800x450.png`、`after-dusk-800x450.png`、`after-continue-800x450.png`、`after-night-cpu1-800x450.png`、`after-night-cpu6-800x450.png`、`after-night-cpu2fps-800x450.png`。
- 更新原 1280×720：`01-title.png`、`02-tutorial.png`、`03-night1-combat.png`；新增 `08-repair.png`、`09-continue.png`。04–07 保留。
- 数值：`r3-results.json`；宿主清单：`host-before.sha256` / `host-after.sha256`。

三档标题无溢出，Play / Skip / Mute 都在窗口内且不小于 44px；路障大按钮在 800×450 可见可操作。纯 CrazyGames 游客入口无 AlterU guest-shell，因此不注入平台栏隐藏样式；本次不以竖屏手机作为目标。
范围内评分：层级 4、统一性 4、可读性 4、反馈 3、素材 4、桌面适配 4、打磨 3（均为 AI 检查，不代表发行审核）。

## 尚未证明 / 保留风险

- 真实无 GPU 硬件未测；不足 2 FPS 时输入和画面本身仍会顿，倒计时正确不等于操作流畅。
- 大于 10s 的单次停顿只详细回补前 10s，余时推进倒计时而不重放全部战斗；这是有界 catch-up，不是完整离线战斗模拟。
- 800×450 夜间底部的原有快捷键文字与技能区域有轻微重叠（P2，按钮和主要信息可用）；本轮不扩展 HUD 重做。
- 没有新玩家复述/真人试听，`comprehension unverified`；不宣称玩法更好玩或教学理解通过。
- 既有无 SDK、音乐体积等风险未在这三项修复里扩展处理。
- 未合并 PR、未推 master、未部署、未提交 CrazyGames。
