type Locale = 'zh' | 'en'

const zh = {
  title: '余光街区', subtitle: 'AFTERLIGHT DISTRICT', start: '接通余光', skip: '跳过引导',
  rescueTitle: '先把人救出来', rescueBody: '点按闪烁的房屋，搜救被困居民。', rescue: '开始搜救', rescuing: '正在破门搜救',
  assignTitle: '让每个人做擅长的事', assignBody: '把工人拖到工作台，匹配岗位可获得 100% 效率。',
  worker: '工人 · 林', workerSkill: '修造效率 100%', dragHint: '拖到工作台', assigned: '岗位匹配',
  proofTitle: '街区开始运转了', proofBody: '人物工作、废料增长、电线亮起——这就是你的核心循环。', continueRepair: '修复第一道防线',
  repairTitle: '天黑前修好路障', repairBody: '怪潮会沿两条道路靠近。花费 10 废料修复路障。', repair: '修复路障',
  dusk: '黄昏', duskTitle: '怪潮正在接近', duskBody: '路灯能让进入光区的敌人减速。准备守住发电机。', ready: '准备守夜',
  defense: '第一夜', overdrive: '路灯过载', overdriveReady: '等敌人进入灯区', overdriveUsed: '光区已过载',
  core: '核心', barricade: '路障', day: '第 1 日', power: '电力', food: '食物', scrap: '废料', morale: '士气', resourcesLabel: '当前已解锁资源',
  winTitle: '第一夜守住了', winBody: '你救出居民、建立生产并让经营成果真正参与了防守。', replay: '再走一遍核心循环',
  failTitle: '发电机熄灭了', failBody: '防线破损后没有及时减速敌人。调整分工再试一次。', retry: '调整后重试',
  help: '重播当前引导', soundOn: '关闭声音', soundOff: '开启声音', loading: '正在接通街区模型',
  efficiency: '工作台 · 匹配 100%', wrongDrop: '把工人放到发光的工作台', tutorialDone: '已掌握',
  introRule: '三夜 · 一束信号', sceneLabel: '余光街区 3D 游戏场景',
  stepRescue: '01 · 搜救', stepAssign: '02 · 分工', stepPrepare: '03 · 备战', coreLoopOnline: '核心循环已启动',
  overdriveCost: '8 电力 · 8 秒', dawnOne: '黎明 01', signalLost: '信号中断',
  mentorName: '值守员 · 乔', workerName: '工人 · 林',
  inspectHouse: '查看信号屋', inspectWorkbench: '查看工作台', inspectBarricade: '查看南路路障',
  mentorRescueLine: '东街还有生命信号。林被困在屋里！', workerHelp: '有人吗？门卡住了！',
  workerAssignLine: '我会修东西。让我去工作台。', workerProofLine: '接通了！这些废料能修好路障。',
  mentorRepairLine: '南路失守前，把路障撑起来。', mentorDuskLine: '灯下会拖慢它们。等我喊“现在”。',
  mentorOverdriveLine: '它们进灯区了——现在！', workerOverdriveLine: '光区压住它们了！',
  objectiveLabel: '当前任务', objectiveRescue: '救出信号屋里的林', objectiveAssign: '把林派到发光的工作台', objectiveRepair: '修复南路的路障',
}

const en: typeof zh = {
  title: 'Afterlight District', subtitle: 'AFTERLIGHT DISTRICT', start: 'Restore the light', skip: 'Skip tutorial',
  rescueTitle: 'Get them out first', rescueBody: 'Tap the flashing house and rescue the trapped resident.', rescue: 'Start rescue', rescuing: 'Forcing the door',
  assignTitle: 'Put every skill to work', assignBody: 'Drag the worker to the bench for 100% efficiency.',
  worker: 'Worker · Lin', workerSkill: 'Repair output 100%', dragHint: 'Drag to workbench', assigned: 'Perfect assignment',
  proofTitle: 'The block is working', proofBody: 'A resident works, scrap rises, and the line lights up—your core loop.', continueRepair: 'Repair the first defense',
  repairTitle: 'Fix the barricade before dark', repairBody: 'The horde follows two roads. Spend 10 scrap to restore the barricade.', repair: 'Repair barricade',
  dusk: 'Dusk', duskTitle: 'The horde is close', duskBody: 'Streetlights slow enemies inside their pools. Keep the generator alive.', ready: 'Stand watch',
  defense: 'Night one', overdrive: 'Overload lights', overdriveReady: 'Wait for enemies in the light', overdriveUsed: 'Light zone overloaded',
  core: 'Core', barricade: 'Barricade', day: 'Day 1', power: 'Power', food: 'Food', scrap: 'Scrap', morale: 'Morale', resourcesLabel: 'Resources currently in use',
  winTitle: 'Night one survived', winBody: 'You rescued a resident, started production, and turned preparation into defense.', replay: 'Replay the core loop',
  failTitle: 'The generator went dark', failBody: 'The line broke before enemies were slowed. Reassign and try again.', retry: 'Adjust and retry',
  help: 'Replay this hint', soundOn: 'Mute sound', soundOff: 'Enable sound', loading: 'Connecting district models',
  efficiency: 'Workbench · 100% match', wrongDrop: 'Drop the worker on the lit workbench', tutorialDone: 'Learned',
  introRule: '03 NIGHTS · 01 SIGNAL', sceneLabel: 'Afterlight District 3D playfield',
  stepRescue: '01 · RESCUE', stepAssign: '02 · ASSIGN', stepPrepare: '03 · PREPARE', coreLoopOnline: 'CORE LOOP ONLINE',
  overdriveCost: '8 POWER · 8s', dawnOne: 'DAWN 01', signalLost: 'SIGNAL LOST',
  mentorName: 'Warden · Jo', workerName: 'Worker · Lin',
  inspectHouse: 'Show me the signal house', inspectWorkbench: 'Show me the workbench', inspectBarricade: 'Show me the south barricade',
  mentorRescueLine: 'A life signal on East Street. Lin is trapped inside!', workerHelp: 'Anyone there? The door is jammed!',
  workerAssignLine: 'I can fix things. Put me on that workbench.', workerProofLine: 'The line is live! This scrap can fix the barricade.',
  mentorRepairLine: 'Brace the barricade before the south road falls.', mentorDuskLine: 'The light slows them. Wait until I call “now.”',
  mentorOverdriveLine: 'They are in the light—now!', workerOverdriveLine: 'The light is holding them back!',
  objectiveLabel: 'CURRENT OBJECTIVE', objectiveRescue: 'Rescue Lin from the signal house', objectiveAssign: 'Assign Lin to the lit workbench', objectiveRepair: 'Repair the south-road barricade',
}

function detectLocale(): Locale {
  const saved = localStorage.getItem('game_locale')
  if (saved === 'zh' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export const locale = detectLocale()
const dict = locale === 'zh' ? zh : en
export function t(key: keyof typeof zh): string { return dict[key] }
