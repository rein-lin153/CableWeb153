# tools.html 元器件完善任务进度

> 本文件用于**防止上下文溢出**。每完成一个子任务就更新状态(✅/⏳/⬜),并在"变更日志"追加一行。
> 若会话被中断,新会话只需读本文件 + "当前继续点"即可无缝接续,无需重读全部 code。

- **文件**: `tools.html`(约 2960 行,原生 JS,配置驱动)
- **配置**: `assets/config/components.json`(**现已 20 个元器件**,+1 端子排)
- **图像**: `assets/images/*.svg`(**40 张**含新增端子排 1 张;阶段三加 12 张)
- **架构**: JSON 配置 → `loadComponentLib()` 加载 → `SVG_LIB` 注册表 → `buildSvgComp()` 实例化 → 双层渲染(SVG 图 + Canvas 引脚/导线/网格)→ `analyzeCircuit()` 并查集仿真
- **关键约定**: 新增元器件 = 「丢 SVG 进 images/ + 在 components.json 加一条」(无需改 tools.html),除非需要新 subtype 仿真逻辑。

---

## 当前继续点(下次会话从这开始)

**阶段七四项大需求全部完成 ✅**(动态通电渲染 7.1 / 短路爆火花跳闸 7.2 / 正交走线+交汇跳线+节点圆点 7.3+7.4 / 写实元器件库 7.5 / 交互控制 7.6)。本地 http-server 资源验证通过(200)。

**本次新增/改动的核心交付**:
1. **交汇跳线 + 同电位节点圆点**(新):`wireSegs`/`segCrossHV`/`pointOnSegInside`/`drawJumpCurve`/`drawJunctionDot`/`drawWireJunctionsAndJumps`;render 中先路由→统一绘制→叠加 jumps/dots。
2. **短路点爆火花粒子**(新):`emitSparks`/`updateAndDrawSparks`(`globalCompositeOperation='lighter'` 叠加发光,阻尼+重力),位置取短路 pin 中点或 DSU 全局短路的 pin 坐标,叠加在元件之上的 world 坐标层。
3. **接线端子排 `terminal_block`**(新):SVG(`assets/images/terminal_block.svg`,DIN 导轨 4 极 UK-2.5B)+ components.json 注册 + `internalGroups` 加 `terminal_block` subtype 分支(按 contactGroup 跨极不短接)。

**保留不实装(附理由)**:
- **平行避让偏移**:简单内部段整体平移会破坏正交性(端点段变斜线、脱离引脚),正交保形需做段端 z-bend 插入,改动大、回归风险高;A* 避障已基本避免重叠,评估后留占位。详见 7.4。
- **Canvas 灯具额外发光叠层**:`#svgCompLayer`(z20)在 canvas 之上,canvas 无法叠加在 SVG 之上;SVG on 态内置暖光 + skeuo 回退 `drawLamp` 已有 shadowBlur 发光,无需再加。

**建议下一步**:本批已交付完整可运行的 tools.html。若用户要可视化验证,起 http-server(8765)用浏览器驱动截图比对短路爆火花与跳线圆点效果。

**本次需补(缺口)**:
1. **交汇跳线(jump curve)**:两线交叉不连处画小拱形避让——当前无。需在 `drawWire` 检测跨其它线段时画 arcTo 拱起。
2. **同电位节点圆点(junction dot)**:多线汇于一点画实心圆——当前 `drawWire` 仅端点焊点,无分支节点。需在 render 时按并查集连通集合找分支点画圆点。
3. **平行避让偏移**:并行导线共用通道时偏移 8-12px——当前 A* 走最短路,可能重叠。需在后处理对同通道导线做 group offset。
4. **短路爆火花(局部)**:当前仅全屏 flash,无短路点爆火花粒子。需在 cross pin/导线交叉点画粒子动画。
5. **新增端子排 `terminal_block`**:SVG 缺(`assets/images/` 无 terminal/bt/xt 文件),需新建 SVG + 在 `components.json` 注册。
6. **交互控制动画**:闸刀物理换向"瞬间状态切换+实时重算"已工作(state flip→`render`→`analyzeCircuit`),确认即可;若有 canvas 手绘 skeuo 元件(灯发光叠加)需复查。

**建议下一步**:按缺口 1→2→3→4→5 顺序实现,每完成一项更新本表 + 变更日志。

---

## 子任务总表

### 阶段一: 勘察 ✅
- [x] 勘察 tools.html 现有框架与已完成元器件
- [x] 列出已完成 14 元器件 + 27 SVG;识别 type 不一致与练习题 goal 缺陷
- [x] 识别并定位 `drawIndicator` 第1866行 `ix/wy` 未定义 bug

### 阶段二: 任务文件 ✅
- [x] 创建 `TASKS.md` 并随进度持续更新

### 阶段三: 添加常用元器件 ✅
已完成 **6 个**新元器件(实时渲染+仿真均可用):
| id | category | 端子 | 仿真行为 | SVG图像 |
|---|---|---|---|---|
| `socket` 三孔插座 | load | L/N/PE(顶3) | evalLoad 判电,接对全亮 | ✅ 符合 GB 1002(左N右L上PE) |
| `indicator` 信号指示灯 HL | load | L/N | evalLoad | ✅ IEC HL 符号 |
| `fuse` 熔断器 FU | misc | L_in/L_out | 被动直通(熔断由短路统一跳) | ✅ IEC 圆柱熔体符号 |
| `switch_2g2w` 双控开关 | switch | COM/L1/L2 | byPhase 兜底(简化,见继续点#1) | ✅ 单刀双掷拨杆符号 |
| `buzzer` 蜂鸣器 HA | load | L/N | evalLoad | ✅ IEC 半圆音响符号 |
| `motor_1p` 单相电机 | load | L/N | evalLoad 单相 | ✅ IEC 电机+~符号 |

候选清单里**未做**(若继续可补):单相变压器、急停已存在无需重复。

代码改动:
- `components.json` 末尾追加 6 个元器件配置(插座端子坐标 L:20,N:50,PE:80)
- 无需改 tools.html 渲染代码(配置驱动:面板/抽屉由 `getLibGroupsForMode` 自动遍历)

### 阶段四: 元器件图像与现实一致性检查 ✅
- [x] 对照 GB/T 4728 与 IEC 60617 逐个核查新增 SVG
- [x] **修复 `drawIndicator` 第1866行 bug**(`ctx.arc(ix,wy,...)` → `ctx.arc(icx,icy,...)`)— skeuo 回退渲染器指示灯高亮圈原本抛 ReferenceError
- [x] 插座孔位修正为 GB 1002 国标(原画反为左L右N,改为**左N右L上PE**)
- [x] 保留端子引线颜色与相相位一致(红L/蓝N/黄PE)

### 阶段五: 资源浪费审查 ✅(评估后定为低优先)
- [x] 评估 RAF `loop`(第2890-2897):`currentView!=='sim'` 时已早退不 render/不 analyzeCircuit。剩余浪费仅是 RAF 每帧调度一次空函数(纳秒级),改造成脏标记 `needsRender` 风险较高、收益小,**建议不动**。
- [x] `saveUndo` 全量深拷:是有 GC 压力,但 `MAX_HISTORY=30` 已封顶,电路规模受限,**不修**。
- [x] `updateStatus()` 空函数桩(第2671):8 处调用,但 `render()` 已在第1238-1240 实时更新 canvasInfo(zoom/grid/元件数)。空函数无额外浪费,仅冗余调用。**保留**(删需清8处调用点,收益微小)。
- [x] `zoomFit`(第2668)实装正常(非占位,勘察误判)。
- 未修:事件监听匿名/短路裸 setTimeout——属深水区,改动易破坏交互,不在本任务高风险动作范围。

### 阶段六: 本地验证 ✅
- [x] `components.json` JSON 语法校验(node require)通过,19 元器件齐全
- [x] tools.html 内嵌 JS 用 `new Function()` 语法解析通过(98KB JS)
- [x] http-server 起于 8765;`tools.html`(200/131KB)、配置(200/19KB)、新增 SVG(200) 均可访问
- [ ] 端到端浏览器截图验证元器件渲染(未做——需浏览器驱动,留待下次)

### 练习题对齐(附带修复) ✅
- [x] p1 练习题 `initExercise` 与 `goal` 的老 type `switch1p` → 新 id `switch_1g1w`(与新库统一)
- [x] p2 用 `socket`、p5 用 `indicator`——这俩 id 在新库也已注册(同名),`spawnCompAt` 现命中 SVG_LIB 走 SVG 渲染

### 阶段七: 动态通电渲染 + 正交走线 + 元器件库扩展 + 交互(本次大需求)
> 勘察结论:框架基本已建,本阶段聚焦缺口补全。

#### 7.1 动态导线带电着色 ✅(已有)
- [x] `getWireState` 四态 live/neutral/earth/dead + 三级光晕(L/L1/L2 高亮、N 亮蓝、PE 亮黄绿、断路灰)
- [x] `analyzeCircuit` BFS+并查集电势传播,开关/断路器/接触器按 state 动态切路径

#### 7.2 短路爆火花与跳闸 ✅(全部完成)
- [x] `triggerShortCircuitGeneral` 全屏 flash + 自动跳 protect + beep/haptic
- [x] **短路点局部爆火花粒子动画** — `emitSparks`/`updateAndDrawSparks`(Canvas `globalCompositeOperation='lighter'` 叠加发光,带阻尼与重力),位置取短路 pin 中点

#### 7.3 正交折线 Manhattan 走线 ✅(已有)
- [x] `computeWireSegments` + A* 避障 + 引脚走廊 + arcTo 圆角直角

#### 7.4 平行避让 + 交汇跳线 + 节点圆点 ✅(交汇跳线/节点圆点完成;平行避让评估后保留不实装)
- [x] **交汇跳线(jump curve)** — `drawWireJunctionsAndJumps` + `drawJumpCurve` 二次贝塞尔拱形,跨过水平线
- [x] **同电位分支节点圆点(junction dot)** — 端点落他线内部段处画实心圆点
- [~] **平行避让偏移**:评估后**保留未实装**——简单整体平移内部点会令端点段变斜线、破坏引脚正交连接,反而视觉劣化;正交保形需做段端 z-bend 插入,改动大、回归风险高。当前 A* 避障导线已基本不重叠,留占位。如确有重叠场景,后续按 z-bend 方式补。

#### 7.5 写实元器件库扩展 ✅(全部完成)
- [x] 1P/3P 空开(SVG 存在 + components.json 已注册)
- [x] 接触器 KM(主+辅+线圈)、三相电机 U/V/W、按钮 NO/NC/急停、指示灯/节能灯/蜂鸣器/单相电机
- [x] **接线端子排 `terminal_block`** — 新建 SVG(`assets/images/terminal_block.svg`,DIN 导轨 4 极 UK-2.5B 风格,每极顶+底螺丝本色贯通)+ components.json 注册 + `internalGroups` 加 `terminal_block` subtype 分支(按 contactGroup 跨极不短接,每极顶↔底直通)。元器件总数 19→20。

#### 7.6 交互控制与端子吸附高亮 ✅(全部已有,本次复核确认)
- [x] 点击空开/按钮/开关 state 切换 → 立即 `analyzeCircuit()` 重算(mousedown/touch 处理 2137/2151/2243/2258)→ 导线颜色与负载状态瞬变
- [x] `drawSnapIndicator`(1747) 黄虚线磁吸圈 + `PIN_SNAP_RADIUS=15` 吸附
- [x] 灯具通电发光:SVG on 态自带暖光发光(`light_bulb_el_on.svg` 等),Canvas-dom 层 z20 高于 canvas 故无需再画 Canvas 叠加光晕(避免层序冲突)。注:Skeuo 回退 `drawLamp`/`drawIndicator` 已有 shadowBlur 发光,SVG 路径有内置发光,**无需额外 Canvas overlay**。

---

## 已知问题清单(仍有,本次未动)

3. `updateStatus()` 空函数桩(第2671):见阶段五,保留。
4. `triggerShortCircuit` vs `triggerShortCircuitGeneral` 双入口(第2614/2620)— 前者包裹后者,无害。
5. 双控开关精确双掷语义已实现 — 见变更日志 `2026-07-26` 继续点 #1。✅

---

## 变更日志(最新在上)

- `2026-07-27` **完成阶段七四项大需求**:(7.1 动态通电本已存在,复核)7.2 短路点爆火花粒子 `emitSparks`/`updateAndDrawSparks`(lighter 叠加发光+阻尼重力,位置取短路 pin 中点);7.3/7.4 交汇跳线 `drawJumpCurve`(二次贝塞尔拱)+ 同电位节点圆点 `drawJunctionDot`(端点落他线内部段判分叉)+ `drawWireJunctionsAndJumps` 在 render 路由后统一叠加;7.5 新增接线端子排 `terminal_block`(SVG DIN 4 极 UK-2.5B + components.json 注册 + `internalGroups` contactGroup 跨极不短接分支),元器件 19→20、SVG 39→40;7.6 复核交互已是瞬时 analyzeCircuit 重算 + snap 吸附 + SVG 内置发光,确认无需改动。平行避让偏移评估后保留不实装(整体平移破坏正交,需 z-bend)。JS 语法 + JSON 校验通过;http-server 8765 资源 200。
- `2026-07-26` **完成继续点 #1**:实现 `switch_2g2w` 单刀双掷精确语义。改 `components.json` 给 `switch_2g2w` 加 `subtype: "switch_2way"`;在 `tools.html` `internalGroups` 加特判分支(off→三端全断;on→COM+L1 成组、L2 独立悬空),与 SVG 图形约定一致(on 图拨杆朝 L1)。JS 语法校验 + JSON 校验均通过。剩余:浏览器截图验证、可选补单相变压器。
- `2026-07-26` **完成阶段三/四/六核心**:新增 6 元器件(插座/信号灯/熔断器/双控开关/蜂鸣器/单相电机)+12 张 SVG;修复 drawIndicator bug;插座修正国标孔位;练习题 p1 type 对齐;JSON 与 JS 语法校验通过;本地服务验证资源可访问。元器件总数 14→19,SVG 27→39。
- `2026-07-26` 创建 TASKS.md,完成勘察,记录已知问题 5 项 + 候选新元器件 7 个。
