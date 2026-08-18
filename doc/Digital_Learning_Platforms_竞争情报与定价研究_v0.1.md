# Digital Learning Platforms 竞争情报与定价研究 v0.1

> 研究日期：2026-08-12\
> 样本：SaaSworthy Digital Learning Platforms 分类。当前页面显示 40
> 个产品。该分类混合互动课堂、内容创作、学科训练、学习平台、学校基础设施和企业培训，因此本文按与
> KnownMap 的业务相关性重新分类。

## 1. 执行结论

1.  "把静态内容变成互动学习内容"已经是成熟需求。Edpuzzle、Pear
    Deck、ClassFlow、Mexty、SoftChalk
    分别从视频、幻灯片、课程包和课堂交付切入。
2.  AI 自动生成互动课程已经出现直接竞争。Mexty 能从 Prompt 生成
    lesson、quiz、activity，再用拖拽编辑器修改并导出 SCORM。
3.  AI 自动出题很难成为壁垒。Edpuzzle 已把 Question Generator 和
    Autograding 放进 Teacher Assist。
4.  AI 定价已有两条路线：AI 作为订阅功能；订阅 + AI Credits。Mexty 对
    KnownMap 最有参考价值。
5.  学校市场大量采用询价制。SaaSworthy 当前分类统计：18 个 Quotation
    Based、11 个 Subscription、11 个 Freemium；基础套餐平均约 \$10/月。
6.  KnownMap 更值得验证的差异：
    -   原视频仍留在 YouTube/Bilibili 等原平台；
    -   AI 在学生观看时继续提问、追问、解释、回放和反馈；
    -   Creator 的教学方法被编码成 Interaction Package，由 Runtime
        面向大量学生执行。

## 2. SaaSworthy 分类概况

  指标                     当前值
  ------------------ ------------
  产品数                       40
  AI-Powered 标签               4
  Freemium                     11
  Subscription                 11
  Quotation Based              18
  Free Trial                    3
  SaaS/Web/Cloud               26
  Android                       9
  iOS                           8
  基础方案平均价格     约 \$10/月

注：SaaSworthy 的 AI-Powered 标签不能代表所有实际拥有 AI
功能的产品，因此本文不把 4/40 当作真实 AI 渗透率。

## 3. 最重要的直接/近直接产品

### 3.1 Mexty

**定位：** AI-powered no-code authoring platform。

**工作流：**
`Prompt → AI 生成 Lesson / Quiz / Activity → Drag & Drop → Personalization / Branching / Gamification → SCORM → LMS`

**能力：** AI
生成课程、Quiz、Activity、多媒体、分支、游戏化、个性化、协作、Version
Control、Reusable Libraries、SCORM Export、LMS Integration。

**定价：**

  Plan               月付    年付折算      Credits   超额 Credit
  -------------- -------- ----------- ------------ -------------
  Free                 €0          €0   10，一次性         €0.20
  Creator           €9/月    €8.10/月        50/月         €0.16
  Professional     €29/月   €26.10/月       200/月         €0.14
  Enterprise       Custom      Custom          TBD           TBD

**收费逻辑：**
`Subscription + Included AI Credits + Usage-based Extra Credits`

**KnownMap 相关性：★★★★★**

结论：Mexty 已经证明"AI 自动设计互动课程"不能单独构成 KnownMap
的核心差异，同时验证 Creator Studio 可以采用固定订阅 + AI Credits。

### 3.2 Edpuzzle

**定位：** 把视频变成可检查、可提问、可评估的学习活动。

**工作流：**
`YouTube / Khan Academy / Crash Course / Upload → 问题/Voice → 分配学生 → 观看 → Watch/Rewatch/Answer Data → Assessment`

**能力：** 视频内问题、Voice Narration、Watch
Tracking、Assessment、Student Progress、LMS integration、Teacher
Assist、AI Question Generator、Autograding。

  -------------------------------------------------------------------------
  Plan                                          价格 核心限制
  --------------------- ---------------------------- ----------------------
  Basic                                         Free 前 20 个 Video
                                                     Lessons；Teacher
                                                     Assist

  Pro Teacher                             \$13.75/月 Unlimited Video
                                                     Lessons / Uploads /
                                                     Recording / Student
                                                     Projects

  School / District                           Custom 机构能力、管理、集成
  -------------------------------------------------------------------------

**AI 收费：** AI 没有独立 token/credit 价格，主要作为套餐能力。

**KnownMap 相关性：★★★★★**

结论：如果 KnownMap 只是"视频 + AI 出题"，差异不足。更强的方向是 AI
在 Runtime 中根据学生回答继续教学。

### 3.3 Pear Deck

**定位：** 把课堂 Slides 变成实时 formative assessment 和互动课堂。

能力：Interactive Questions、Polls、Quizzes、Teacher-paced /
Student-paced、Draggable / Drawing、Audio、Individual
Feedback、Google/Microsoft/LMS integration。

  Plan                           价格
  --------------------- -------------
  Basic                          Free
  Individual Premium      \$149.99/年
  Schools & Districts          Custom

**价值计量：** Teacher license / institutional deployment。\
**相关性：★★★★**

### 3.4 ClassFlow

**定位：** Cloud-based lesson delivery + interactive presentation。

能力：Interactive Presentation、Poll、Quiz、Formative
Assessment、Real-time Analytics、Messaging、Personalized Feedback。

**价格：** Custom / Quotation Based。\
**相关性：★★★★**

### 3.5 SoftChalk Cloud

**定位：** Web-based eLearning content authoring + hosting。

架构：`SoftChalk Create → Web Lesson → LMS / CMS / Web Server / Mobile / Cloud`

**相关性：★★★★★（架构）**

它验证了 Authoring 与 Runtime/Delivery 分离。KnownMap 的
`Creator Studio → Interaction Package → Extension/App/Player Runtime`
属于同类架构思想。后续必须继续研究 SoftChalk、H5P、SCORM、xAPI。

## 4. AI 与个性化学习

### OnCourse AI

高风险医学考试平台。能力包括 100,000+ questions、LLM
explanations、Personalized Learning Path、Weakness Analysis、Spaced
Repetition、Mock Exams、AI chat。

  Plan               价格
  --------- -------------
  Free            Limited
  Monthly      \$11.99/月
  Yearly      \$119.99/年

付费版强调 Unlimited chats、Unlimited personalization、Unlimited daily
quizzes/flashcards、Unlimited learning games。AI 采用 Subscription 包含
Unlimited 的方式。

### Leapp

AI personalized learning plans、资源组织和 Progress Tracking。SaaSworthy
显示起价 \$4.99，并有 Free Plan。

### eSpark

K-12 Reading + Math personalization，学校/学区导向。价格 Custom。

### NoRedInk

Writing + adaptive
practice。包括句子操作、outline、长文练习、诊断、成长报告和
Gradebook。价格 Custom。

### Edgenuity Pathblazer

`Diagnostic → Learning Gap → Data-driven Instruction Path`。SaaSworthy
当前没有可靠公开起价。

## 5. 技能与实践型学习

### Rapid Steno

AI stenography training：real-time dictation、typing
practice、performance analytics、exam modules。**\$3/月起**，有 Free
Trial。

### PraxiLabs

Virtual Science Lab。Simulation、Unlimited repetitions、Instant
guidance、Performance Tracking。

  Plan                             价格
  ---------- --------------------------
  Free         20 simulations / 1 month
  Semester           \$44.99 / 6 months
  Annual                 \$74.99 / year

### Codio

Hands-on computing & tech skills education。强调 interactive/immersive
learning 和 flexible pathways。SaaSworthy 当前没有可靠公开价格。

### Typing.com

Free：grade-based lessons/tests/games、70-day data
retention。Plus：Custom pricing，增加 ad-free、unlimited
retention、student-level customization、rostering、live
progress、benchmarking 等。

**这一组的共同启示：**
越是"必须做才能学会"的技能，普通视频的缺口越明显，KnownMap
的互动层价值越高。

## 6. 内容与学科平台

-   **ABCmouse for Schools**：11,000+ standards-aligned
    activities，Custom。
-   **Discovery Education**：200,000+
    视频、文本、Podcast、互动资源，支持 SSO/LMS/QR，Custom。
-   **News-O-Matic**：K-8 新闻阅读，leveled articles、discussion
    questions、Quick Quizzes、comprehension activities。
-   **Read Naturally**：Research-based reading intervention。
-   **MindTap**：Cengage 数字学习平台。
-   **SplashLearn**：Math adaptive learning + game-like interface，Free
    Plan。
-   **Prismatext**：Diglot Weave，将目标语言词汇嵌入小说和故事，Custom。
-   **Chegg**：24/7 study support、step-by-step solutions、expert
    answers 等。

## 7. 基础设施与周边

### Clever

K-12 SSO / roster / education infrastructure。

  Plan                          价格 单位
  ------------------------ --------- ------------------
  Secure Sync Enterprise     \$16/月 per school/month
  Secure Sync                \$19/月 per school/month
  Custom                      Custom institution

该 SaaSworthy 价格数据更新时间较早，仅作计价结构参考。

### Certfy

Digital Certificate generation。SaaSworthy 显示起价 \$880，并有 Free
Plan。与 KnownMap 核心关系低。

### Confetti

Team-building / professional development experience
marketplace。Custom。

## 8. 企业学习与 Coaching

-   **Kairos**：Data-driven LXP，根据业务数据提供个体学习计划，询价。
-   **uExcelerate**：AI-enabled leadership development /
    coaching，1:1、group coaching、marketplace，询价。

企业学习产品普遍更愿意购买管理、规模化交付和业务结果，因此常见 Custom
Pricing。

## 9. 定价策略矩阵

  -------------------------------------------------------------------------------
  产品          Buyer             Pricing Metric        起价/公开价 AI收费
  ------------- ----------------- --------------- ----------------- -------------
  Mexty         Creator/Trainer   Seat + AI                   €9/月 Credits
                                  Credits

  Edpuzzle      Teacher           Teacher                \$13.75/月 套餐包含
                                  subscription

  Pear Deck     Teacher/School    Teacher/year          \$149.99/年 非主要计价

  OnCourse AI   Student           User                   \$11.99/月 Unlimited in
                                  subscription                      plan

  Leapp         Learner           User                    \$4.99 起 套餐内
                                  subscription

  Rapid Steno   Learner           User/month                 \$3/月 套餐内

  PraxiLabs     Learner           Time access           \$44.99/6月 无独立 AI
                                                                    计价

  Clever        School            School/month            \$16 起\* 非 AI 核心

  NoRedInk      School            Institutional              Custom 未单列
                                  quote

  eSpark        School            Institutional              Custom 未单列
                                  quote

  ClassFlow     School/Teacher    Quote                      Custom 未单列

  Discovery     School            Quote                      Custom 未单列
  Education
  -------------------------------------------------------------------------------

## 10. 对 KnownMap 定价的直接启示

### Creator Studio 价格带

公开个人教师/Creator 产品大致集中在 **\$10--30/月**：

-   Edpuzzle：\$13.75/月
-   Pear Deck：约 \$12.50/月（按 \$149.99/年折算）
-   Mexty：€9/月 / €29/月

第一阶段可以测试：

`Free → Creator $9–15/月 → Pro $25–35/月`

这里只是市场价格带，不应直接作为最终定价。

### Runtime AI 会改变成本函数

Edpuzzle 的 AI 大量发生在制作阶段。KnownMap 如果实现：

`学生回答 → AI理解 → AI追问 → AI解释 → AI决定回放 → 再测试`

成本更接近：

`Total AI Cost ≈ Creator-generation cost + Student count × Runtime interactions`

长期可能需要： - Studio Credits + Runtime Credits；或 - Creator
Subscription + Included Student AI Minutes/Sessions + Overage。

### Mexty 是目前最值得参考的 AI 计价模型

可以模拟：

`Free → Creator → Professional → Enterprise`

同时测试真正适合 Runtime 的 value metric： - Active Students - AI
Teaching Sessions - AI Teaching Minutes - Monthly Learner Interactions

## 11. 已经商品化的能力

这些能力不能再单独当核心壁垒：

-   AI 自动出题
-   Prompt → Lesson
-   Quiz generation
-   Drag & Drop lesson editor
-   Branching
-   Gamification
-   Basic personalization
-   LMS export
-   Student analytics
-   Video 内插入问题

## 12. KnownMap 当前仍值得验证的空白

### A. Existing-video-native

`Creator 已有 YouTube/Bilibili 视频 + 不迁移视频 + 外挂 Interaction Layer`

### B. Runtime AI Teacher

普通平台：`预先设计问题 → 学生回答 → 固定反馈`

目标：`Creator Teaching Intent → 学生回答 → AI理解学生状态 → 追问/解释/回放/示例/再练习 → 继续原视频`

### C. Creator-controlled Teaching Agent

老师定义： - 哪里必须停 - 什么算掌握 - 常见误区 - AI 如何解释 -
什么时候追问 - 什么时候回放 - AI 自由度 - 哪些内容必须使用老师原话

这些规则进入 Interaction Package。

### D. Interaction Package + Runtime

`Creator Studio → Interaction Package → Browser Extension / Web Player / App / Future Devices → Learner`

## 13. 研究优先级

**P0：** Mexty、Edpuzzle、SoftChalk、H5P、SCORM/xAPI\
**P1：** Pear Deck、ClassFlow、OnCourse AI、Codio、PraxiLabs、NoRedInk\
**P2：** eSpark、Clever、Discovery Education、ABCmouse、Typing.com\
**P3：** Rapid Steno、Leapp、News-O-Matic、Prismatext、Read
Naturally、MindTap、SplashLearn、Kairos、uExcelerate、Certfy、Confetti、Chegg、Pathblazer

## 14. 当前战略结论

"AI 把普通视频变成互动课堂"适合解释产品，但不足以构成长期战略定位。

更值得验证的是：

> **让老师录完视频以后，AI 继续按照老师的方法教每一个学生。**

结构：

`Teacher creates once → AI learns teaching design → Video stays on original platform → Every learner gets interaction/practice/feedback → Teacher sees what students understood`

如果这个能力成立，KnownMap 与"视频插题""AI lesson generator""互动
Slides"之间才会形成更明显的产品边界。

## 15. 数据质量说明

-   SaaSworthy 当前主页面显示 40 个产品；第二页缓存版本曾显示 37
    个，榜单会动态变化。
-   部分价格记录较旧，例如 Pear Deck、Clever，因此只用于理解计价结构。
-   没有可靠公开价格的产品均标为 Custom/未公开，没有推测价格。
-   "相关性、优先级、KnownMap 启示"属于本项目商业分析，不属于
    SaaSworthy 原始评价。

## 16. 主要来源

-   SaaSworthy Digital Learning Platforms:
    https://www.saasworthy.com/list/digital-learning-platforms
-   Mexty pricing: https://www.saasworthy.com/product/mexty-ai/pricing
-   Edpuzzle: https://www.saasworthy.com/product/edpuzzle
-   Edpuzzle pricing:
    https://www.saasworthy.com/product/edpuzzle/pricing
-   Pear Deck pricing:
    https://www.saasworthy.com/product/pear-deck/pricing
-   OnCourse AI pricing:
    https://www.saasworthy.com/product/oncourse-ai/pricing
-   Rapid Steno pricing:
    https://www.saasworthy.com/product/rapid-steno/pricing
-   PraxiLabs pricing:
    https://www.saasworthy.com/product/praxilabs/pricing
-   Clever pricing:
    https://www.saasworthy.com/product/clever-platform/pricing
-   NoRedInk: https://www.saasworthy.com/product/noredink
