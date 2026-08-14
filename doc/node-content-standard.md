# 节点内容与展示标准

版本：0.4
更新时间：2026-08-14
状态：目标契约。本文件定义**节点这一层**：一个节点的边界（第 4 节）与它装进学习窗口的内容（第 5 节）。窗口本身（尺寸、呈现方式、生命周期、键盘、习题本、AI 问答、证据）见 `doc/learning-window-standard.md`。当前 D0/D1 的 `type: multiple_choice | fill_blank | free_answer` 是本标准的子集，替换前不得混用两套字段。

## 1. 这份标准解决什么

学生看到的一切都在同一个一级窗口里。窗口负责怎么显示，本文件负责显示什么。

老师增加的每一个节点，都必须能写成同一份纯数据。后面无论用哪种宿主去播：

- Chrome 插件覆盖在 B 站原页面上；
- 网页自己的课程壳；
- 本地视频 App 控制本机播放器；

窗口里的内容结构都相同。换宿主只换「谁负责读时间、暂停、把窗口挂到哪里」，不换题目、提醒、评价和学习证据。

其它 App 或页面要接入，只消费这份数据，不允许各自发明一套节点格式。

本标准管两件事：

1. 老师增加节点时填哪些字段；
2. 窗口内容区展示哪些结构化内容。

本标准不管：窗口尺寸与呈现方式、习题本、AI 问答、账号、分发、计费、多语言、自定义 HTML/CSS/JS。课程包只提供数据，行为由宿主实现。这与 `doc/multi-creator-platform.md` 1.4 节一致。

**窗口内自足**是硬约束：一个节点的内容必须在窗口内能完整表达。画面高亮、字幕遮挡、原声降低都只是增强，关掉之后学生仍须能完成这个节点。详见窗口标准第 2 节。

## 2. 三层必须分开

```text
课程包（纯数据）
  family / interaction / trigger / display / evaluation / effects
        │
        ▼
宿主（行为）
  插件 | 网页 | 本地视频 App
  PlayerAdapter + HostCapabilities
        │
        ▼
一级学习窗口
  骨架、档位、呈现方式、生命周期  → doc/learning-window-standard.md
        │
        ▼
窗口内容区
  本文件第 5 节的内容块
```

禁止把这三层揉进一个 `type` 字段。现在仓库里同时存在三套名字，本标准把它们收口：

| 旧名字 | 本标准 | 含义 |
|---|---|---|
| 重点提醒 / `attention` / 注意力爆发 | `family: attention` | 教学意图：让学生看清这一点 |
| 老师补充 / `voice` / 老师语音 | `family: voice` | 教学意图：老师再补一句 |
| 互动练习 / `activity` | `family: practice` | 教学意图：学生必须动手 |
| 点评追问 / `ai` | `family: followup` | 教学意图：迁到自己的经历并受评 |
| `multiple_choice` / `fill_blank` / `free_answer` | `interaction` | 学生怎么作答，不是节点为什么存在 |
| 字幕遮挡、暂停、降原声 | `effects` | 平台相关的建议性修饰，不是一种新题型 |

教师工作台示例页直接暴露五个可拖拽组件，并把底层 `family + interaction` 组合隐藏在组件名称后：重点标注、老师补充、选择题、填空题、问答题。真实工作台应使用相同名称；“问答题”对应 `followup + free_text`。

## 3. 封闭枚举

平台维护封闭集合。创作者不能注入新类型、HTML、脚本或自由 CSS。新需求先问：能否写成现有 family 的 `display` / `evaluation` / `effects` 属性。只有平台可以新增枚举值。

### 3.1 节点族 `family`

| family | 老师看见的名字 | 学生要做什么 | 默认作答方式 |
|---|---|---|---|
| `attention` | 重点提醒 | 看清被标出的内容并确认 | `notice` |
| `voice` | 老师补充 | 听或读老师补上的那一句 | `listen` |
| `practice` | 互动练习 | 按老师配置的方式作答 | 老师选 `choice` / `blank` / `order` / `match` |
| `followup` | 点评追问 | 用自己的经历作答，按量规评价 | `free_text` |

### 3.2 作答方式 `interaction`

| interaction | 用于 | 第一版 |
|---|---|---|
| `notice` | attention | 要做 |
| `listen` | voice | 要做 |
| `choice` | practice | 要做，对应现有选择题 |
| `blank` | practice | 要做，对应现有填空题 |
| `order` | practice | 协议保留，但不进入当前教师工作台五组件面板 |
| `match` | practice | 可收敛，暂不进 Demo |
| `free_text` | followup | 要做，老师界面名称为“问答题” |
| `dictation` | practice | 延后：涉及麦克风与评测 |

不合法组合在保存时拒绝，例如 `family: attention` 配 `interaction: choice`。

### 3.3 展示面 `surface`

同一份 `display` 可以画在多种面上，内容块不变，只变外壳宽窄：`overlay`、`docked`、`sheet`、`preview`、`report`。定义与挂载规则见窗口标准第 6 节。

## 4. 节点对象与边界

### 4.1 一个节点是什么

**一个节点 = 在视频的一个时间点，为一个教学点，打开一次窗口。**

三个「一个」都是边界：一个时间点、一个教学点、一次窗口。任何一条被突破，就该拆成两个节点，或者根本不该做成节点。

由此得到节点层的四条硬规则：

1. **自足。** 节点不依赖其它节点是否完成。
2. **有限。** 节点必然结束，学生总能回到播放。
3. **本地。** 节点只作用于当前视频的当前分 P，不跨视频、不跨课程、不离开当前页面。
4. **可解释。** 打开窗口就必须说明为什么打开。没有内容的纯暂停不是节点。

### 4.2 节点对象

每个节点是课程包 `nodes[]` 里的一个对象。字段稳定，未知字段必须忽略。

```js
{
  id: 'node-1',                 // 课程内稳定 id，不随排序改写
  enabled: true,
  family: 'attention',
  interaction: 'notice',

  trigger: {
    kind: 'time_cross',         // time_cross | manual
    timeSeconds: 39,
    captionId: null             // 可选，锚到导入字幕
  },

  display: { /* 见第 5 节，按 family 分支 */ },
  evaluation: null,             // attention / voice 可为 null

  recap: null,                  // 可选，见 4.6
  groupId: null,                // 可选，见 4.4
  references: [],               // 可选，见 4.4

  effects: {                    // 播放意图，建议范围，见 4.5
    pause: true,
    coverCaptions: null,
    duckOriginal: false,
    loopRange: null,
    preventSkip: false
  },

  continueBehavior: 'manual'    // manual | auto_after_seconds
}
```

公共约束：

- `id` 必填，课程内唯一，保存后不回收。
- `timeSeconds` 必须落在视频时长内；正式节点时间必须人工核对过对应片段。
- 多分 P 视频里，节点绑定到具体 `partId`，不跨分 P 触发。
- `display.title` 必填，用于时间线说明、节点行标题、窗口标题、完成情况表。
- 所有给老师或学生看的字符串都是纯文本。渲染走 `textContent`，禁止 `innerHTML`。
- 高亮、选项、步骤都是结构化数组，禁止把 HTML 或 Markdown 当内容。
- 媒体只允许课程包内的资源 id，禁止任意外链。
- `continueBehavior` 只描述「学生确认后如何继续」，不描述宿主会不会暂停。

### 4.3 三种时间不要混

节点身上最多有三个时间概念，作用完全不同：

| 概念 | 字段 | 是什么 | 范围 |
|---|---|---|---|
| 触发时刻 | `trigger.timeSeconds` | 什么时候打开窗口 | 强制 |
| 效果区间 | `effects.coverCaptions` / `loopRange` | 效果在哪一段生效 | 建议 |
| 回看区间 | `recap.range` | 要学生重看视频的哪一段 | 见 4.6 |

触发是一个点，不是区间。「从 2:00 到 2:30 一直显示某个东西」不是节点，那是效果区间，属于建议范围。

时间约束：

- 相邻两个节点的触发时刻**建议**至少间隔 30 秒。连续打断会让学生放弃。
- 节点不应落在视频最后 15 秒内，否则学生做完没有可继续的内容。
- 一节课的节点数量**建议**不超过每 10 分钟 8 个。超出时老师端提示，不阻止保存。

这三条是建议，不在保存时硬拦，但老师工作台应当提示。

### 4.4 节点之间：可以引用，不能依赖

**默认所有节点互相独立。**

理由是运行时现实：学生会拖进度条、会跳过、会回看，宿主可能不认识某个节点类型。只要允许「做完 A 才能做 B」，这些情况都会把学生锁死在一条断掉的链上，而这条链在老师那边是看不见的。

因此明确禁止：

- 前置条件、解锁、必须按顺序完成；
- 条件分支：答对走 A、答错走 B；
- 一个节点增删、启用或停用另一个节点；
- 节点嵌套：节点里再开一个节点。

允许两种弱关联，它们都不影响能否作答：

- `references: ['node-1']`：内容上相关。窗口里可以显示「这和前面的能力词提醒有关」，节点 1 没做也不影响做这个节点。
- `groupId: 'evidence'`：同一个教学点的几个节点归为一组。只用于时间线归拢和报告聚合，不产生先后要求。

答错后的处理留在节点内部：重试、给解释、给提示。不做跨节点跳转。

### 4.5 节点能对播放器做什么

先回答「是否只是暂停一下视频」：**暂停是默认，但暂停本身不构成节点。** 节点必须同时打开窗口并说明原因。只让视频停住、不告诉学生为什么，学生只会以为卡住了。

节点可声明的播放意图是封闭集合，全部属于窗口标准 2.2 节的建议范围：

| 意图 | 含义 | 需要的能力 |
|---|---|---|
| `pause` | 打开窗口时暂停 | `canPause` |
| `loopRange` | 在一段区间内重复播放 | `canSeek` |
| `preventSkip` | 窗口打开期间不允许跳过 | `canSeek` |
| `coverCaptions` | 遮挡字幕带 | `canOverlayVideo` |
| `duckOriginal` | 降低原声 | `canDuckAudio` |

不允许的播放行为：

- 改变播放速度以外的画面处理（裁剪、滤镜、缩放）；
- 静音之外的音频改写；
- 无限期阻塞：`preventSkip` 只在窗口打开期间有效，关闭即解除；
- 强制全屏或退出全屏；
- 跳到别的视频。

按 family 的默认值：

| family | pause | duckOriginal | 其它 |
|---|---|---|---|
| attention | true | false | 可选 `coverCaptions` |
| voice | false | true | 可选老师音频 |
| practice | true | false | 可选 `preventSkip` |
| followup | true | false | 无 |

### 4.6 回看前面的内容

老师经常需要让学生「回头看一下刚才那段」。这件事有三种做法，代价差别很大，所以按能力分三层，而不是二选一。

**第一层，必须有：窗口内的静态回看。**

```js
recap: {
  range: { start: 20, end: 39 },
  quote: "I'm hard-working, diligent, loyal, flexible and knowledgeable.",
  note: '刚才这句连续列举了五个能力词。'
}
```

窗口内容区直接给出那一段的字幕原文和一句说明。所有端都能做，不需要任何播放器能力。这是窗口内自足的要求：**没有任何回看能力的端，学生也必须知道要回看的是什么。**

**第二层，建议做：原播放器跳回去，再自动回来。**

需要 `canSeek`。流程：

```text
学生点「重看这一段」
  -> 记下 returnTo = 当前触发时刻
  -> seek 到 recap.range.start，正常播放
  -> 窗口收成最小态，显示「重看中 · 回到练习」
  -> 播到 recap.range.end，或学生点「回到练习」
  -> seek 回 returnTo
  -> 窗口恢复原状，草稿和已选答案原样保留
```

关键几条：

- 窗口在重看期间**不关闭**，只收成最小态。关掉学生就找不回来了。
- `returnTo` 在进入重看前记录，不依赖学生记忆，也不依赖窗口重新触发。
- 重看不重新计入触发，不产生第二条节点证据，只记 `recapPlayed` 次数。
- 重看期间不触发其它节点，队列照窗口标准第 7 节处理。
- 中途学生自己拖动进度条，视为放弃回来，窗口恢复但不再自动 seek。

**第三层，暂不做：画中画另开一个播放窗口。**

用户提的难点是对的，而且不止一个：

- 跨源播放器根本开不了第二个可控实例，网页端直接出局；
- 画中画没有可靠的「回到原处」，脱离页面后回来的位置不受控；
- 同一视频同时播两路，注意力分散，部分平台的条款也未必允许；
- 第二层已经解决了同一个教学需求，代价低得多。

因此第一版不做。真要做，也只能作为第二层之上的可选增强，而且必须保留同样的 `returnTo` 语义。

三层的关系是叠加，不是替代：填了 `recap` 就一定有第一层，有 `canSeek` 的端在此之上加第二层按钮。老师只填一次 `recap`，不为不同端准备不同方案。

### 4.7 节点不做什么

划清楚这些，才能保证任何端都能安全地实现节点：

- 不跳到其它视频、其它课程、外部链接或新页面；
- 不修改课程结构，不增删或启停其它节点；
- 不设置前置条件、解锁和分支；
- 不无限期阻塞播放，任何状态下都能继续；
- 不依赖网络才能显示基本内容，AI 只影响反馈，不影响题目呈现；
- 不采集与本节点无关的数据；
- 不在窗口外承载不可替代的内容；
- 不携带代码、标记或样式。

任何一条要突破，先按本文件第 14 节的扩展规则立项，不在节点字段里开口子。

## 5. 各族展示内容

这是标准的核心：老师填写的就是学生看到的。学生端效果预览不是另一套文案，而是同一份 `display` 用 `surface: preview` 画出来。

### 5.1 重点提醒 `attention`

老师填：

| 字段 | 含义 | 必填 |
|---|---|---|
| `display.title` | 这一节点在干什么 | 是 |
| `display.body` | 提醒正文 | 是 |
| `display.highlights[]` | 要标出的词或短句 | 建议有 |
| `display.captionQuote` | 对应字幕原句，便于老师核对 | 建议有 |

```js
display: {
  title: '能力词是结论，后面还要补证据',
  captionQuote: "I'm hard-working, diligent, loyal, flexible and knowledgeable.",
  highlights: [
    { text: 'hard-working' },
    { text: 'diligent' },
    { text: 'loyal' }
  ],
  body: '这些词能概括优势，但需要用做过的事证明。'
}
```

学生看到的内容块：暂停提示（若宿主能暂停）→ 标出的词 → 提醒正文 →「知道了 / 继续」。

学习证据：`seen | skipped | unsupported`。无对错。

### 5.2 老师补充 `voice`

老师填：

| 字段 | 含义 | 必填 |
|---|---|---|
| `display.title` | 补充的目的 | 是 |
| `display.transcript` | 老师要说的原文 | 是 |
| `display.audioAssetId` | 预录音频，课程包内资源 | 否 |

没有音频时，所有宿主都改为展示文稿。有音频但宿主不能播或不能降低原声时，同样回退到文稿。文稿不是降级装饰，它是这份节点的权威内容。

学生看到的内容块：老师补充文稿（或音频进度）→「继续」。

学习证据：`listened | transcript_only | skipped | unsupported`。

### 5.3 互动练习 `practice`

老师填公共字段，再按 `interaction` 填分支：

| 字段 | 含义 | 必填 |
|---|---|---|
| `display.title` | 练习名称 | 是 |
| `display.prompt` | 题目 | 是 |
| `display.captionQuote` | 对应字幕原句 | 建议有 |
| `evaluation.explanation` | 对错之后的解释 | 是 |

选择题 `choice`：

```js
interaction: 'choice',
display: {
  title: '判断这句有没有证据',
  prompt: '下面哪一句给出了具体证据？',
  options: [
    { id: 'a', label: 'I am hard-working.' },
    { id: 'b', label: 'I stayed late to finish the client deck.' }
  ]
},
evaluation: {
  answer: 'b',
  explanation: '第二句说出了做过的事，第一句只是形容词。'
}
```

填空题 `blank`：

```js
interaction: 'blank',
display: {
  title: '补上 Action',
  prompt: 'I noticed a problem, so I ______ a different approach.'
},
evaluation: {
  acceptedAnswers: ['suggested'],
  normalize: ['trim', 'casefold'],
  explanation: '视频里的动词是 suggested。'
}
```

排序题 `order`：

```js
interaction: 'order',
display: {
  title: '排出处理同事冲突的四个步骤',
  prompt: '把四步排成视频中的顺序。',
  items: [
    { id: 'reflect', label: 'assess my own words and actions' },
    { id: 'private', label: 'speak privately' },
    { id: 'listen', label: 'understand their feelings' },
    { id: 'solve', label: 'find an amicable way forward' }
  ]
},
evaluation: {
  correctOrder: ['reflect', 'private', 'listen', 'solve'],
  explanation: '先反思自己，再私下沟通，听对方，最后一起找办法。'
}
```

学生看到的内容块：题目 → 作答控件 → 提交 → 对错与解释 → 重试 / 跳过 / 继续。

对错由 `evaluation` 本地决定，不调用 AI。缺少标准答案时老师侧不得保存。

### 5.4 点评追问 `followup`

老师填：

| 字段 | 含义 | 必填 |
|---|---|---|
| `display.title` | 追问名称 | 是 |
| `display.prompt` | 要学生回答的问题 | 是 |
| `display.scaffold[]` | 必须覆盖的结构，如四步 | 建议有 |
| `evaluation.rubric[]` | 评价维度 | 是 |
| `evaluation.lessonPatterns[]` | 希望用到的课程表达 | 否 |

```js
display: {
  title: '用四步法回答“你如何应对压力”',
  prompt: 'How do you handle stress? 用自己的一次真实经历回答。',
  scaffold: ['remain calm', 'ask questions', 'assess options', 'take action']
},
evaluation: {
  rubric: [
    { id: 'calm', label: '保持冷静' },
    { id: 'questions', label: '提出问题' },
    { id: 'options', label: '评估选择' },
    { id: 'action', label: '采取行动' }
  ],
  lessonPatterns: ['remain calm', 'ask questions', 'assess my options', 'take action']
}
```

学生看到的内容块：问题 → 结构提示 → 自由作答区 → 提交 → 分维度反馈与修改稿 → 再提交或继续。

AI 失败时保留原文，明确写「未生成反馈」，不得用套话冒充个性化评价。无 AI 的宿主仍必须能展示题目、结构提示和作答区，并把 `aiStatus: unavailable` 写入证据。

## 6. 内容进入窗口

宿主不要直接拿课程包去拼 DOM。节点先收成窗口渲染模型，再画。窗口骨架、`header`/`content`/`feedback`/`status`/`actions` 分区、按钮封闭集合和渲染模型见窗口标准第 4 节。

本文件只决定 `content` 区里有什么。`content.kind` 与 `interaction` 一一对应，其它端可以自己画像素，但不能发明新的 `content.kind`。

字段长度受窗口档位约束，上限见窗口标准第 5 节。超限在老师保存时报错，不由其它端截断。

## 7. 宿主能力与降级

播放控制与画面增强属于平台建议范围，不强制。宿主启动时声明能力，运行时不得假装拥有没有的能力。能力清单与挂载规则见窗口标准第 2.2、6、16 节。

对内容的影响只有一条：**降级只改触发和挂载，不改 `display`。**

| 缺的能力 | 对内容的处理 | 证据怎么记 |
|---|---|---|
| 不能读时间 | 节点按时间顺序列出，学生手动打开，内容不变 | 标 `openSource: learner`、`trigger: manual`。**仅限教师预览等次要场景，不可作为学生端主形态，见下方说明** |
| 不能暂停 | 同样展示内容块，不承诺画面冻结 | `effects.pause` 记入 `unsupportedEffects` |
| 不能覆盖画面 | 窗口改用 `docked` 或 `sheet`，内容不变 | 不影响完成状态 |
| 不能播老师音频或降原声 | 展示 `display.transcript` | `transcript_only` |
| 不认识 `family` 或 `interaction` | 显示 `unsupported` 应用，不白屏 | `unsupported`，不得记成跳过或完成 |

**2026-08-14 补充：「不能读时间」这一行不适用于学生端主形态。** 定时触发不是与其它能力并列的一项功能，而是五类节点的共同前提——重点标注要在那句话出现时标出，老师补充要在那个语境里插入，三种题型要在讲完对应段落时问。失去定时触发不是少一个效果，而是五类节点同时失效，所以 `trigger: manual` 只适合教师预览、能力探测或未来别的宿主，不能当作学生学习路径。学生宿主因此固定为装了插件的 B 站原页面，见 `doc/lessons.md` 2026-08-14 条目。

任何宿主只要展示节点，就必须用同一份 `display`，不能另写一套「网页专用题目」。

## 8. 学习证据

证据分两层，都按节点 id 对齐。窗口层记录「怎么打开、停留多久、怎么关的」，形状见窗口标准第 14 节。下面是节点层的作答事实：

```js
{
  nodeId: 'node-2',
  family: 'practice',
  interaction: 'order',
  status: 'completed',          // pending | opened | drafted | answered
                                // | completed | skipped | dismissed | unsupported
  trigger: 'time_cross',        // 或 manual
  unsupportedEffects: [],
  attempts: [
    {
      response: ['private', 'reflect', 'listen', 'solve'],
      correct: false,
      submittedAt: 'ISO-8601'
    }
  ],
  feedback: '...',
  revisedAnswer: null,
  aiStatus: null                // ok | failed | unavailable | null
}
```

四个状态必须分开，不能都显示成「未完成」：

- `skipped`：学生明确点了跳过；
- `dismissed`：学生关掉窗口，没作答；
- `drafted`：写了一半没提交；
- `unsupported`：宿主不会画这个类型。

老师据此判断的是完全不同的三件事：学生放弃、学生卡住、产品没显示出来。

## 9. 老师拖入组件就是填写标准字段

工作台组件不是自由备注。老师把五个组件之一拖到时间线后，系统按对应 `family + interaction` 打开表单；保存结果必须能直接放进 `nodes[]`。

```text
从组件栏选择重点标注 / 老师补充 / 选择题 / 填空题 / 问答题
  -> 拖到目标时间点
  -> 可选：勾一段字幕作为回看片段（自动生成 recap.range 与 quote）
  -> 填写组件对应的 display / evaluation
  -> 用同一份数据生成 surface: preview
  -> 写入节点行，时间线出现对应图标
```

五个组件的映射为：重点标注 = `attention + notice`；老师补充 = `voice + listen`；选择题 = `practice + choice`；填空题 = `practice + blank`；问答题 = `followup + free_text`。各表单与第 5 节字段一一对应。不要为预览再准备第二套文案。教师工作台示例页可以不持久化新增节点，但必须让老师看见：换组件就是换标准字段，生成效果用的是刚填的内容。

真实工作台中，拖入组件后先持久化带稳定 `id` 的节点草稿。字段修改是否防抖自动保存由参数面板的“自动保存”复选框控制，默认开启；关闭时只保留本地编辑态，直到手动保存。保存过程明确区分 `saving`、`saved`、`save_failed`。失败时保留本地未提交内容并提供重试，不得覆盖旧版本或伪装成已保存。手动“保存节点”始终可用于立即提交或失败重试。

时间线图标、节点行左侧、学生端效果、完成情况列，共用 `id`、编号、`family` 和 `display.title`。

## 10. 其它 App 的调用面

其它页面或 App 只应依赖窗口标准第 16 节的调用面，而不是依赖 B 站 DOM 或某一张网页的 class 名。与内容直接相关的两个：

```text
validate(lesson) -> 通过 | 字段错误
evaluate(node, response) -> { correct?, feedback, aiStatus? }
```

`adapter` 沿用 `doc/design.md` 的 `PlayerAdapter`：`detect`、`getCurrentTime`、`pause`、`play`、`seek`、`subscribeNavigation`、`teardown`。本地视频 App 实现同一接口，不要为 App 另做一套节点协议。

课程包读取入口必须保持单一。今天读本地配置，以后读缓存或服务端，只替换这一处。

## 11. 版本与未知类型

课程包顶层带 `schemaVersion`。当前目标为 `1`。

```js
{
  schemaVersion: 1,
  id: 'english-interview-demo',
  title: '英语面试表达：把答案说得具体',
  video: {
    ref: { platform: 'bilibili', videoId: 'BV1WW4y1e7GL' },
    durationSeconds: 513
  },
  nodes: [ /* 第 4 节 */ ]
}
```

- 次版本只加可选字段；老宿主忽略未知字段。
- 新 `family` / `interaction` 是主版本行为，老宿主按第 7 节记 `unsupported`。
- 一次学习会话锁定进入时的课程包版本，中途不热切换。
- 窗口标准有独立版本号，与 `schemaVersion` 分开，见窗口标准第 15 节。
- 已存进习题本的条目保存内容快照，课程包升版不改写它，见窗口标准第 12 节。

## 12. 与当前 Demo 的映射

D0/D1 现有节点是本标准的子集，映射如下。实现替换前，Demo 代码可继续用旧字段，但新的老师外形和新宿主不得再扩大旧字段。

| 旧 `type` | family | interaction |
|---|---|---|
| 无（重点提醒尚未进入 Demo 配置） | `attention` | `notice` |
| 无（老师补充尚未进入 Demo 配置） | `voice` | `listen` |
| `multiple_choice` | `practice` | `choice` |
| `fill_blank` | `practice` | `blank` |
| 旧设计曾使用的排序练习（当前组件面板已移除） | `practice` | `order` |
| `free_answer` | `followup` | `free_text` |

`doc/design.md` 第 4 节的 Lesson Configuration 在替换完成前仍是 Demo 运行时契约。本文件是目标契约。两者冲突时：已实现的 Demo 行为以 `doc/requirements.md` 为准；老师增加节点、学生展示内容和跨宿主复用以本文件为准。

`student-web/` 及其 `course.json` 已于 2026-08-14 删除，节点由插件在 B 站原页面消费。这不妨碍老师工作台按本标准展示节点内容。

## 13. 样例课的 8 个交互节点

教师工作台示例页使用以下 8 个节点。时间点和中文教学意图来自已纳入仓库的中文字幕；英文短句仍须老师复核原声。

| id | 时间 | 老师界面组件 | family | interaction | `display.title` |
|---|---:|---|---|---|---|
| `node-1` | `00:39` | 重点标注 | `attention` | `notice` | 能力词是结论，后面还要补证据 |
| `node-2` | `02:10` | 选择题 | `practice` | `choice` | 找出“为什么选择我们”的具体理由 |
| `node-3` | `02:49` | 选择题 | `practice` | `choice` | 处理同事冲突，第一步做什么 |
| `node-4` | `03:24` | 老师补充 | `voice` | `listen` | 弱点回答要包含真实问题和改进措施 |
| `node-5` | `05:40` | 填空题 | `practice` | `blank` | 补全任务优先级表达 |
| `node-6` | `06:19` | 问答题 | `followup` | `free_text` | 用自己的经历回答压力问题 |
| `node-7` | `06:55` | 重点标注 | `attention` | `notice` | 兴趣不只列清单，还要说明带来的价值 |
| `node-8` | `07:49` | 问答题 | `followup` | `free_text` | 完成“为什么应该录用我”的个人回答 |

教师工作台、学生效果预览和完成情况必须共用这些稳定 `id`、编号、时间和标题。节点 06 是示例页默认选中状态，播放器和时间线都定位在 `06:19`。

## 14. 扩展规则

以后要加能力，按这个顺序判断：

1. 只是换播放器？新增 `PlayerAdapter`，不动 `display`。
2. 只是换挂载位置？新增或改用 `surface`，不动 `display`，见窗口标准第 6 节。
3. 只是多一种练习操作？在 `practice` 下新增 `interaction`，并补对应 `content.kind`。
4. 出现新的教学意图？才新增 `family`。必须同时定义老师字段、窗口内容块、证据状态和未知宿主降级。
5. 出现的不是教学节点，而是新的学生界面？先问能不能做成窗口内的应用。不能，才讨论新界面。
6. 需要麦克风、词典、外链图片或任意 CSS？单独立项，不塞进节点字段。

验收一条标准是否成立：把同一份节点 JSON 分别交给插件、网页和本地 App，窗口里的标题、题目、选项、解释、评价方向必须一致；不一致的只允许是「能不能自动暂停」和「窗口画在视频上还是视频旁边」。
