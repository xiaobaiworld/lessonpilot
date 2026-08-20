# Lessons — KnownMap

Version: 0.6
Last updated: 2026-08-20

## 2026-08-20 — 固定媒体的兜底时长也必须有真源

编辑器没有导入字幕时仍需要一条完整时间轴，但“最低时长”不是可以随手填写的视觉参数。把 `222` 秒写进初始化选项后，刻度、结束标记、键盘 End 定位和节点百分比都一致地工作了，却一致地指向了错误的 `03:42`。项目的课程包规范早已把同一视频定义为 `513` 秒；错误来自另建了一份未命名的时长真源，而不是时间线计算本身。

固定媒体应由课程配置中的 `durationSeconds` 驱动全部时间语义。当前只有一个固定视频，因此先复用规范里的 `513` 秒常量；扩展到多课节时，应把时长进入课节数据模型，而不是增加 BVID 分支或从最后一个节点反推片尾。验收也不能只看文案，要比较轴线右端、结束标记中心和最后刻度三个位置是否一致。

## 2026-08-20 — 本地授权码密钥必须先持久化，再生成可长期测试的码

授权码数据库只存 HMAC 摘要是正确的安全边界，但它意味着服务端 secret 也是数据可用性的一部分。如果 secret 只存在于一次启动进程的临时环境，重启后历史记录仍在，却再也无法验证原授权码。会话密钥丢失只让用户重新登录，授权码密钥丢失则会永久废掉全部已发码，两者风险不同。

本地开发也应先建立被 Git 忽略的稳定 `.env`，再 seed 账号、发布课程和创建授权码。迁移或重启服务前先确认密钥来源，不能把“数据库还在”误当成授权凭证仍可用。数据库和日志继续只保存摘要、尾号和固定字段，不因调试需要记录原文。

## 2026-08-14 — YouTube 可以用并排答题，但原生全屏恢复必须来自用户点击

YouTube 的禁止遮挡规则不等于播放器不能和学习窗口共存。IFrame Player API 官方提供 `getCurrentTime()`、`pauseVideo()`、`playVideo()` 和 `setSize()`，所以网页可以在节点时间到达时暂停视频，把播放器缩到页面一侧，再在它的边界之外显示学习窗口。这个方案不是在播放器上加透明层或弹窗，而是真正重新排版；播放器任何像素和控制栏都不能被盖住。缩小后的视口仍须至少 `200×200`，16:9 且保留控制栏时采用官方建议的至少 `480×270`。

交互状态机应固定为：到点后 `pauseVideo()`；若当前处于原生全屏，先 `document.exitFullscreen()`；播放器缩小并显示旁侧学习窗口；答题完成后先移除窗口、恢复播放器尺寸和可见性，再 `playVideo()`。恢复为页面内大播放器可以自动执行，但重新进入浏览器原生全屏受 Fullscreen API 的瞬时用户激活限制，必须直接发生在学生点击「提交并全屏继续」的事件处理里，并保留请求失败时只恢复页面内播放的降级。移动端还需真机验证，不能把桌面浏览器结果直接外推。

因此，YouTube 网页学生端的合规基线是「暂停 + 缩小播放器 + 旁侧答题 + 点击恢复」，不是任何形式的覆盖式弹窗。恢复播放前播放器应重新处于可见位置，且超过一半位于屏幕内，以满足 YouTube 对脚本播放可见性的要求。

## 2026-08-14 — 自动弹窗就是产品本身，因此平台选择决定交付形态

定时自动打断不是「效果更好的版本」，没有它就没有这个产品。这一条要求把此前被当作待定的一串问题全部定了下来。

需要说清它在结构里的位置：**定时触发不是与其它能力并列的一项功能，而是全部节点类型的共同前提。** 重点标注要在那句话出现的时刻标出来，老师补充要在那个语境里插进去，选择题、填空题、问答题都要在讲完对应段落时问。所以「在某个时间点打开窗口」是五类节点共用的地基，不是其中一种玩法。把它降级成可选增强，不是少一个功能，而是五类节点同时失效——早先记录里「定时弹窗算增强不算基线」的说法只针对弹窗这一个动作，不适用于建立在它之上的整套节点体系，已按此更正。

### 技术边界

定时节点要靠读取当前播放秒数来触发。插件能做到，是因为它的 content script 被注入进 B 站页面，那里的 `<video>` 就是同一个文档里的普通元素——`src/content/video/bili-player.js` 直接读 `currentTime`、直接监听 `timeupdate`。而网页用跨源 iframe 嵌入 `player.bilibili.com` 时完全够不着它：`contentWindow.document` 被浏览器拦掉，B 站也没有公开的 `postMessage` 接口。这不是实现努力能改变的，是浏览器安全边界。

跨源读时间的其它路线已逐条排查，全部封闭：

- **读进度条像素**不可能。没有任何 API 能把跨源 iframe 画进 canvas。
- **`getDisplayMedia()` 屏幕共享**技术上成立，但不可用：每次学习都要弹共享权限、B 站嵌入播放器控制栏会自动隐藏导致进度条大部分时间不在画面上、OCR 遇到皮肤和清晰度变化就失效、还要持续占用 CPU。
- **用墙上时钟从上次 seek 推算**，在学生手动暂停的那一刻就开始撒谎。
- **把视频代理到自己服务器**等于重新托管别人的内容，是把合规问题放大而不是解决。

而且即使拿到了当前秒数也不够：**跨源 iframe 无法暂停**。最接近的做法是重载到 `t=X&autoplay=0`，代价是黑屏加重新缓冲，比不暂停更糟。

网页端仍然能做的只有：换 `t=` 参数重载来跳转、在自己页面的 DOM 上盖东西、点击时打开窗口。唯独缺的就是按时间触发。

### 手动打开不能当主形态

`doc/node-content-standard.md` 第 7 节定义了 `openSource: learner` + `trigger: manual` 的降级：内容完全不变，只把「什么时候打开」交给学生。这个降级适合应付宿主缺能力的情况，但**不能作为学生端的主形态**，因为被卖的正是那个强制打断的机制。不要再把它当主路径提出来。

### 合规

除可行性之外，此前还提过一个独立的顾虑：用程序改动别人平台视频的播放行为——暂停、强制 seek、阻止跳过、降低原声——可能不符合 B 站的平台规则。这个顾虑针对的正是插件路径，因为它技术上什么都能做。所以约束不只是「网页做不到」，还包括「能做的地方也不该把产品建在改播放上」。不要把插件的能力当成可以依赖它的许可。

### 由这一条要求锁定的后果

1. **学生端只能是 B 站 + 插件 + PC 浏览器。** 只要课程视频留在 B 站，手机就不可能。`doc/dev-plan.md`、`doc/design.md`、`doc/requirements.md`、`doc/student-runtime.md` 里仍写着的「学生首用网页优先」与此直接冲突，需要改写。

2. **合规风险无法再分散到多条路径上，全部压在插件这一条。** 唯一可用的缓解是把干预面积压到最小：暂停加上自己的 DOM 层，其余一律不碰——不改倍速、不阻止跳过、不降原声、不改播放器 UI。这从建议变成了必须守的线。

3. **装插件成为销售链条上的必经关卡。** 商店不是障碍——Chrome 支持开发者模式加载已解压扩展，`src/` 现在就是这么跑的。代价是每个学生都要过一遍的摩擦：下载解压文件夹、开开发者模式、手动加载、每次启动看到「请停用以开发者模式运行的扩展程序」警告、每次更新手动替换文件夹、文件夹一移动扩展就失效。D0/D1 阶段老师带着少量学生手工装是可接受的；上商店或打包 `.crx` 属于规模期决策，不是前置条件。

4. **教师端的时间真源是导入的字幕文件，不是播放器。** SRT/VTT 本身带精确时间戳，节点定位从不需要询问播放状态。播放器只是用来确认内容的取景器。`doc/teacher-course-workspace-design.md` 第 5.2 节和验收标准第 8 条目前承诺网页播放器与时间线共享同一个当前播放时刻，这个承诺交付不了，需要改写。

5. **老师预览走插件，`student-web/` 不再保留。** 既然学生端只能是 B 站原页面加插件，另建一个网页学生入口就是维护第二套讲不出真实体验的形态。老师要看真实效果，装插件去 B 站原页面看，和学生走同一条路径。代价是老师自己也要装插件——教师端网页只负责编辑，「教师端全程免安装」不再成立。教师工作台里的「学生端效果预览」由此明确降级为静态示意图，不承诺是真实渲染。

6. **YouTube 的定位变了。** 它是唯一提供官方 IFrame Player API（`getCurrentTime`、`pauseVideo`、`seekTo`、`onStateChange`）的平台，因此是唯一能让学生端免安装、可上手机的选择——它是产品形态的备用出口，而不是用来验证 `PlayerAdapter` 抽象是否成立。B 站是唯一逼我们用插件的平台；其它选择要么有官方控制 API，要么是自己托管。D0/D1 只做 B 站的排期不变，变的是 YouTube 被列入的理由。另一个要留意的现实约束：当前买方的课程和学生都在 B 站，这个 API 优势可能触及不到他们。

   **它的叠加限制有合规解法，不要误读成禁止共存。** 政策禁止的是「在播放器**前方**」叠加元素，不是禁止播放器与我们的内容同屏。把播放器放在固定区域（例如左上），需要打断时缩小播放器、在旁边展示学习窗口——画面上没有任何东西盖住播放器，这是合规的。剩下的约束只有尺寸：缩小后视口仍须 ≥200×200，若显示控制栏则要能完整显示（16:9 建议至少 480×270）。由此修正两处早先的判断：`dark-player` 覆盖主题不是被废掉而是不再需要（窗口改为并排）；S09 不用遮挡带，改为用 IFrame API 直接关闭字幕轨（属于 API 文档描述的行为，非擅自修改播放器，具体参数与 captions 模块调用待实测确认）。这个「缩小 + 并排」的布局完全不动播放器画面，反而比在 B 站上盖一层更干净。

   连带影响：`doc/learning-window-standard.md` 目前的挂载假设是覆盖在播放器之上，并排布局是另一种挂载方式，那份标准需要增加一档。

## 2026-08-14 — A Workspace That Needs Narration Is Not an Online Sales Page

A pre-populated workspace can prove that a product exists while still failing to create the conversation needed to sell it. The eight-node page made the product mechanics visible, but a teacher arriving from a short private message still had to infer three missing links: why this mattered to an existing paid course, what changed for the student and teacher, and what to do next.

When the likely acquisition path is online, live narration cannot be a hidden dependency. The page must first let the target buyer recognize the delivery problem, then show the real workspace as evidence, translate example results into a teaching decision, and close with one low-friction action. Keep the operational proof; surround it with the minimum sales narrative needed to earn a follow-up conversation.

## 2026-08-14 — A Real Subtitle File Is Not a Well-Formed One

Timestamp fractions in an exported SRT are a literal millisecond count, and their width varies inside a single file. The supplied interview subtitles use one digit 70 times, two digits 254 times, and three digits 30 times. Padding that field to three digits reads `,6` as 600ms, which put one cue's end before its start; the parser dropped it silently and left an overlapping pair elsewhere. Nothing surfaced the loss because rejecting a malformed cue is also correct behavior.

The test that was supposed to cover this format used `,0` on both ends, where padded and literal readings agree. A fixture can exercise the shape of a real file while still missing the property that makes it hard. When adding format support because of a specific document, take the fixture from the part of that document that actually failed, and assert the parsed count against the file's cue count.

Both lessons generalize: prefer verifying a parser against the whole real input and checking an invariant over it — every cue positive-duration, ordered, non-overlapping — rather than trusting per-case assertions.

## 2026-08-13 — Teach the Product Before Asking Teachers to Resume Work

An operational dashboard assumes a teacher already knows what the product does and has a course in progress. That is the wrong first surface for a new product demonstration: it turns product discovery into unexplained status numbers and a to-do list.

The teacher home should therefore expose the actual workflow in order: connect an existing course and its authorized subtitles, design an action at a caption, preview the student experience, then understand the result structure. Each step needs either a real command or an explicit W0 boundary; never fill the last step with invented reports or a disabled promise.

## 2026-08-13 — One Teacher Screen Needs One Dominant Job

After a teacher understands the basic product idea, a home page that treats setup, preview, results, and classroom design as equal modules competes with the work that matters most. For this W0, subtitle preparation is a prerequisite and student learning evidence is an outcome; neither should visually rival classroom design.

Make the primary task explicit, keep the prerequisite input next to it, and reduce downstream outcomes to only the context needed for a teacher to make a better design decision.

## 2026-08-12 — Page Directories Are Not Separate Local Services

> 2026-08-14 更新：`student-web/` 已删除，现在只剩一个页面目录，但「从仓库根启动服务」这条结论仍然有效——路径与测试用例都相对仓库根解析。

`teacher-web/` and `student-web/` look like two standalone static sites, but the verified W0 topology is one repository-root HTTP server with two paths on the same origin.

Starting each directory independently created misleading URLs, including a stale student-only `4174` entry. The page could appear blank or outdated because the teacher's relative preview link and the student's `course.json` lookup were being evaluated under a different server root.

The canonical local contract is:

- Start `python3 -m http.server 4173` from the repository root.
- Teacher workspace sample: `/teacher-web/`.
- Teacher W0 editor: `/teacher-web/editor.html`.
- Course configuration: `/teacher-web/course.json`.
- Bilibili source presentation: the `embedUrl` in that course configuration, with the original-page link as fallback.
- Do not start `teacher-web/` as its own server root, and do not introduce a second port such as `4174`.

When a page seems stale after cross-machine Git synchronization, verify the commit and service root before changing code. A correct file tree served from the wrong root is an environment error, not a product regression.

## 2026-08-07 — Chrome Extension Is Delivery Shape, Not Product Positioning

Chrome extension is only the fastest first demo format. The product is a course upgrade layer for English teachers.

If the project is described as "an AI English Chrome plugin for students", it competes with large language learning apps. If it is described as "AI assistant layer for a teacher's existing video lesson", it sells to course creators and small training operators.

## 2026-08-07 — Use Real Teacher Video for Sales Demo

VOA/BBC/slow English materials are useful for standard learning flows, but the first sales demo should use a real teacher-style video.

Reason:

- The buyer is a teacher.
- The buyer must imagine their own course being upgraded.
- Public standard materials prove AI learning capability, but teacher videos prove course upgrade value.

## 2026-08-07 — Do Not Treat Copyable UI as the Asset

The side panel, video Q&A, and learning report can be copied quickly.

The durable asset should be:

- Course structuring SOP
- Vertical prompt templates
- Teacher delivery workflow
- Student practice data
- Case studies from real course upgrades

## 2026-08-07 — Course Sellers Buy Commercial Outcomes, Not Video Quality

A teacher who already sells a course does not primarily buy "better video quality." The buying reasons are stronger product differentiation, higher perceived course value, learning evidence, and lower repetitive delivery work.

The product promise should therefore be "upgrade an existing recorded course without re-recording it," not "improve an English video."

Traffic-only creators and batch-generated accounts are weak first buyers because they may have no paid delivery problem or budget to solve.

## 2026-08-07 — Interaction Must Produce a Closed Delivery Loop

Avatar, pause control, and question cards are visible demo elements, but none is sufficient alone.

The minimum defensible loop is:

- Teacher authors a timed node.
- Learner answers when the video pauses.
- The system gives specific feedback and resumes playback.
- The same session data produces learner guidance and teacher evidence.

Teacher preview is required because it proves that course conversion is repeatable rather than a one-off custom animation.

## 2026-08-11 — Expand Platforms After Proof, Not Before

Bilibili and YouTube look similar as "video sites," but each platform is a separate player-adapter problem: DOM, SPA navigation, subtitles, and fullscreen behavior all differ.

Confirmed order:

- D0/D1: Bilibili only.
- After D1: YouTube as the second adapter, to prove the player abstraction is real.
- Later platforms: rank only from real teacher course sources.
- Multilingual and multi-region: redesign only when a real overseas customer appears; do not reserve schema fields now.

The durable preparation is isolating Bilibili selectors behind a player adapter. Building multi-platform registries, locale systems, or regional billing before the first teacher closes a loop is premature expansion.

## 2026-08-11 — Small-B-First B2B2C, Not a Consumer Extension

KnownMap may share a browser-extension shape with consumer products, but the business model is different:

- The teacher buys, configures, distributes, and delivers the course.
- The learner uses the runtime but is not the primary acquisition target.
- Teacher accountability and service reduce dependence on learner self-discipline.
- Learning behavior becomes evidence inside the teacher's delivery workflow.

Consumer capabilities such as cross-course AI credits, review queues, and vocabulary tools may be reserved in the architecture, but they do not justify a separate free/Pro product line before real retention and willingness-to-pay evidence exists.

## 2026-08-11 — Instrument Decisions, Not Users

Behavior data is valuable only when it answers a product or teaching decision.

Keep platform telemetry separate from learner evidence. Record only authorized lesson sessions, never unrelated browsing history. Raw answers belong to the learning session rather than the generic event stream.

Start with local structured events and voluntary export. Anonymous remote telemetry requires explicit notice and consent; identity-linked analytics should wait until automatic teacher reporting or cross-device learner records make identity necessary.

The defensible asset is not a large event warehouse. It is the accumulated link between course structure, learner behavior, teacher delivery, and verified outcomes.

## 2026-08-12 — Treat Cross-Origin Video Embeds as Source Presentation, Not Playback Control

A Bilibili iframe can present the fixed sample course and give the learner a clear route to the original page, but the webpage cannot responsibly promise stable access to its time, pause, or timed-node behavior. Keep that source/presentation path separate from the HTML5 video control path.

The local HTML5 proof needs no upload, backend, or hosting cost: the browser can play a user-selected file through an Object URL and reliably drive the timed interaction loop. Test fixtures must be long enough to reach configured node timestamps; the first web sample uses 1-second and 3-second nodes because they can be verified against a very short public video. These are runtime checks, not final teaching timestamps.

## 2026-08-12 — Match the Interface to the Role, Not the Competitor's Market

Edpuzzle and Nearpod clarify that video can become a lesson, but their K-12 procurement and classroom-demo aesthetics do not match KnownMap's first buyer. The teacher needs a compact operational workspace that says what course needs attention next; the learner needs a quiet one-course delivery surface that says what to watch and answer next.

Provider and compatibility evidence is useful during validation, but it becomes cognitive noise when shown to a learner. Keep that evidence in an explicit tester-only area rather than turning the student page into a platform-choice screen.

## 2026-08-12 — Do Not Let a Convenient Test Substitute Redefine the First Product Slice

A local HTML5 file makes timed interaction easy to prove, but it changes the learner's starting condition and avoids the actual Bilibili integration question. When the task is to validate whether the teacher/student web surfaces make sense around an existing Bilibili course, local files, uploads, and hosted-video design are scope expansion rather than a prerequisite.

For W0, show the fixed source course honestly and link to its original page. Keep controllable playback and timed interaction on the separately proven Bilibili original-page extension path until a web player strategy is explicitly selected.

## 2026-08-12 — Separate Subtitle Intake From Platform Subtitle Scraping

The teacher workflow needs timestamped text before it can support meaningful action editing. A manual SRT/VTT import gives the workflow a real, inspectable input without requiring the product to claim that it can scrape Bilibili subtitles across login, copyright, or platform changes.

The safe first contract is: fixed supported Bilibili link, teacher-provided UTF-8 SRT/VTT file, local parsing, then caption-anchored actions. Reject invalid files without replacing the existing timeline; obtain and manually check the real course subtitle file before treating any imported timestamps as teaching facts.

## 2026-08-19 — Isolate External Intake Links and Fail Closed

An external form URL is operational configuration, not page copy. Keeping the URL, visible label, allowlist and mount behavior in one small module makes the release boundary testable and prevents an internal editor link from being scattered across HTML and deployment scripts.

The verified decision is to hide the whole secondary CTA until a published HTTPS Feishu/Lark URL exists. A placeholder or authenticated editor URL creates a worse failure than temporarily showing only the private-message CTA. Next time, create and anonymously verify the external form before changing the page test from “hidden without URL” to “visible with a public URL.”
