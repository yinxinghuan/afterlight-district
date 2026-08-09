# 资产库存与缺口

## 资产决策原则（第二版修订）

共享库存只承担“存在完全合适身份时直接复用”的效率角色，不能成为美术需求的上限。资产顺序固定为：先由剧情、镜头和玩法定义必须出现的身份与英雄轮廓，再查询 inventory；只有身份、比例和叙事功能都匹配时复用，否则走正式 builder → 评审 → catalog → 导出 → inventory 流程新造。禁止为了减少建模而把故事角色改写成通用工人、保安、僵尸或狼人。

## 实时库存结论

2026-08-07 在环境重构批次正式导出后，从 `_lowpoly_lab/assets/ASSETS.json` 再次机械复核：共 97 个资产、12 个分类。其中可动角色与怪物等角色类资产 56 个，另有 11 种动物、7 个植物/自然、14 个场景组件、8 个道具和 12 个商品。

## 通用库存参考（不是本作选角表）

以下条目只记录库内已有能力，供背景群众、后续经营设施或快速灰盒时查询。它们不构成《余光街区》正式主角、主建筑和敌人的默认选择；首个正式切片已经用后文六个专属身份替换通用工人、保安、僵尸、狼人、普通房屋和普通路灯。

### 可复用背景居民

- 工人：`people__worker`
- 厨师：`people__chef`
- 保安：`office__securityGuard`
- 医护：`archetypes__nurse`、`archetypes__paramedic`
- 消防员：`archetypes__firefighter`
- 店主与普通居民：`people__shopkeeper`、`people__granny`、`people__oldman`、`people__kid`

### 可复用原型敌人

- 普通敌人：`monsters__zombie`
- 快速敌人：`monsters__werewolf`
- 飘忽敌人：`monsters__ghost`
- 重型敌人：`mythic__minotaur`
- 首领候选：`villains__viking` 或 `mechs__combatMech`，但需要重新定义为原创敌人语义，不能沿用现实或既有角色称谓。

### 可复用背景环境与资源

- 街区地块：`scene__grassTile`、`scene__roadTile`、`scene__waterTile`
- 房屋与边界：`scene__house`、`scene__fence`
- 关键光源：`scene__lamp`
- 临时补给：`scene__stall`、`props__produce`、`goods__fruitPile`、`goods__can`
- 自然遮挡：`plants__pine`、`plants__roundTree`、`plants__bush`、`plants__rock`

## 新资产进度

首个垂直切片已正式入库并通过两轮视觉评审：

1. **街区发电机**：`scene__generator`，三枚青绿色能量单元、母排和低权重信标。
2. **可损坏路障基础体**：`scene__barricade`，薄层 cream 警示条纹、slate 主梁和 teal 连接轨。
3. **工作台**：`scene__workbench`，双钳口、夹缝、丝杆与手柄构成明确台钳轮廓。

后续完整经营层仍缺少临时厨房、诊所帐篷、岗哨、废料堆和电池组；这些身份不能用名字相近的模型冒充。

第二版新增的专属身份批次：

1. **电工林**：`people__afterlightLin`，三触点诊断臂铠与头灯直接呼应发电机三电芯。
2. **值守员乔**：`people__afterlightJo`，高过头顶的中继电台背包与琥珀天线形成指挥剪影。
3. **受困信号屋**：`scene__signalHouse`，卡死斜撑门、一明两暗窗和屋顶中继冠共同承载首次搜救剧情。
4. **街区中继灯**：`scene__relayLamp`，双向灯翼明确表现两个敌人减速光区。
5. **熄光壳**：`monsters__blackoutHusk`，空洞中继胸笼和唯一存活的青绿灯丝；不再使用通用僵尸。
6. **缆猎者**：`monsters__cableStalker`，极长缆线双臂、插头爪和插座脸；不再使用通用狼人。

第三版环境重构批次：

1. **连续街区地形**：`scene__afterlightTerrain`，用 L 形高坡、两级错位台地、低位服务路和三段断裂导电管取代 7×9 重复 tile；内部地形连续，外轮廓通过高差和切坡变化。
2. **背景挡土脊**：`scene__afterlightRidge`，低矮、不发光的三级工业挡土体，只负责封闭深景和补充高度层次，不与信号屋争夺轮廓。
3. **受困信号屋重制**：`scene__signalHouse` 保留原身份但重做几何，改为不对称服务站体量、偏置信号塔和更宽的唯一亮窗；不再像放大的通用方盒房屋。

开场正式构图只启用连续地形、背景脊线、重制信号屋与乔。发电机和工作台从岗位教学开始出现；路障与中继灯从防线教学开始出现。通用草地/道路 tile、房屋、围栏和树木不再参与当前垂直切片运行时场景。

## 接入规则

- 游戏复制 GLB 时保留 `<category>__<id>.glb` 身份。
- 加载后按 inventory footprint 与运行时 `Box3` 接地、居中和限高。
- 保留现有 `MeshStandardMaterial`，使用共享三值灯光和正交等距相机。
- 所有角色按命名节点恢复 rig，并相对各自 rest pose 动画。
- 垂直切片只接入明确 roster，不宣称使用“全部角色”；若后续改为完整角色消费者，再运行 `validate-consumer.mjs --all-characters`。
- 新资产必须经过 builder、视觉评审、catalog、批量导出和 inventory 同步，不在游戏项目里用临时方块冒充正式模型。
