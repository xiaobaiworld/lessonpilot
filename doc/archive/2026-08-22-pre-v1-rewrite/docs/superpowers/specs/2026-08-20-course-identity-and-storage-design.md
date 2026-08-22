# 课程身份与本地课程包设计

日期：2026-08-20

状态：已接受并实施。后端多课节、v2 课程包、范围授权、v2-only 插件存储、下载器、运行时、
内置示例课程和课程名称 UI 已完成。

## 目标

为多课程、多课节领取和本地保存建立稳定的课程身份规则：

- 每门课程由后台生成一个独立 UUID；
- 每个课节由后台生成一个独立 UUID；
- UUID 在课程创建时生成一次，之后永久不变；
- 课程名称、学习目标、B 站视频、课节和发布版本都不能替代课程身份；
- 未来课程文件、目录和学习状态都按 `courseId` 隔离；
- 当前只确定身份和边界，不提前实现图片、音频或大文件存储。

内置示例课程使用固定课程 UUID 和课节 UUID，当前包含一个真实示例课节；它以只读来源写入
同一个多课程仓库，不占用或覆盖学生通过授权码领取的课程。

## 当前事实与约束

### 后台

`backend/app/models/course.py` 使用 `uuid4()` 作为 `Course.id` 的默认值。
`0008_multi_lesson_courses` 已移除 `lessons.course_id` 唯一约束，`Course.lessons` 和
`create_lesson()` 已支持多个有序课节。发布与授权服务必须读取 `Course.lessons`，不得再把
第一课节当作整门课程。

### 插件课程契约

插件只接受 `CoursePackage` v2：UUID `courseId`、UUID `lessonId` 和 `lessons[]`。下载响应
只能是 `{ "courses": [...] }`，本地只使用 `studentCourseStore`；旧 `{ "course": ... }`、
`installedCourse` 和 `learningState` 不提供适配或迁移。

### 课程显示

课程界面应显示课程名称 `title`，而不是 UUID、BVID 或其他内部编号。

### 资源范围

图片、音频、字幕附件和其他大资源暂不进入本轮实现。课程核心配置与未来资源文件需要保持可分离，避免资源存储方案反向决定课程身份。

## 课程身份模型

课程身份、课节身份和课程内容分层：

```text
courseId    后台生成的永久 UUID，课程主身份
lessonId    后台生成的永久 UUID，课节主身份
title       学生和老师看到的课程名称，可以修改
goal        学习目标，可以修改
videoRef    课节绑定的 B 站视频，只属于 lesson
releaseId   某个课程发布版本的身份，可以变化
assetId     未来单个图片、音频或附件的身份
```

示例：

```json
{
  "courseId": "7a0c4a42-91c8-4f4d-8a2e-17b89c4f6d21",
  "title": "英语面试表达：把答案说得具体",
  "goal": "让学生学会用具体证据回答英语面试问题",
  "lessons": [
    {
      "lessonId": "1f7b6b18-6b1e-4d2f-bb5e-b5f2a6d7150f",
      "title": "第一节：英文面试完整流程",
      "videoRef": {
        "platform": "bilibili",
        "videoId": "BV1WW4y1e7GL"
      },
      "nodes": [
        {
          "id": "node-1",
          "enabled": true,
          "family": "attention",
          "interaction": "notice",
          "trigger": {
            "kind": "time_cross",
            "timeSeconds": 39,
            "captionId": null
          },
          "display": {
            "title": "回答要具体",
            "body": "用一个真实例子支撑你的回答。"
          },
          "evaluation": null,
          "effects": {
            "pause": true
          }
        }
      ]
    }
  ]
}
```

核心不变量：

1. `courseId` 只在创建课程时生成一次；
2. 修改课程标题、目标、课节标题、课节视频绑定或课程内容不改变 `courseId`；
3. 新增、删除或调整课节不改变 `courseId`；
4. 同名课程可以存在，但 `courseId` 不能重复；
5. `lessonId` 只代表课程中的一个课节，不能替代 `courseId`；
6. `videoRef.videoId` 只用于匹配课节所在的 B 站页面，不代表课程身份；
7. 发布包、授权码关联、插件本地课程记录和学习状态都引用同一个 `courseId`，课节数据再通过 `lessonId` 隔离。

## 课程、课节与视频

课程是学生领取和展示的上层容器，课节是课程中的可学习单元，每个课节绑定一个 B 站视频：

```text
Course
├── courseId
├── title
├── goal
└── lessons
    ├── Lesson 1
    │   ├── lessonId
    │   ├── title
    │   ├── videoRef
    │   └── nodes
    ├── Lesson 2
    │   ├── lessonId
    │   ├── title
    │   ├── videoRef
    │   └── nodes
    └── Lesson 3
        ├── lessonId
        ├── title
        ├── videoRef
        └── nodes
```

授权码领取的是整门课程，而不是单独的一条视频：

```text
授权码
→ 下载一个 courseId
→ 保存课程元数据
→ 保存多个 lessonId
→ 每个课节保存自己的 videoRef、nodes 和学习状态
```

学生进入 B 站页面时，插件按 `videoRef.videoId` 找到当前视频对应的课节，再通过 `courseId + lessonId` 读取正确的节点和学习状态。课程列表显示课程 `title`，课程详情再显示课节标题。

## 后台生成规则

后台提供唯一的课程身份生成方法：

```python
def generate_course_id() -> str:
    """Generate the permanent unique identity of a course."""
    return str(uuid4())
```

课程创建流程：

```text
创建课程请求
→ 后台生成 courseId
→ 保存 Course.id
→ 数据库主键/唯一约束校验
→ 后续所有模块复用该 courseId
```

唯一性由两层共同保证：

- UUID4 提供高概率不重复的生成结果；
- 数据库主键约束提供最终写入边界。

如果数据库写入因为主键冲突失败，后台必须重新生成并重试，不能覆盖已有课程，也不能把标题、BVID 或目标文本直接作为主键。

前端、插件和授权码客户端不得自行生成课程 ID，也不得根据课程标题、学习目标或 BVID 重新计算课程 ID。

## 本地课程组织

未来需要真实目录或课程包时，目录身份使用后台生成的 `courseId`：

```text
courses/
└── 7a0c4a42-91c8-4f4d-8a2e-17b89c4f6d21/
    ├── manifest.json
    ├── metadata.json
    ├── lessons/
    │   ├── 1f7b6b18-6b1e-4d2f-bb5e-b5f2a6d7150f/
    │   │   ├── lesson.json
    │   │   └── learning-state.json
    │   └── 3b4a2d2c-44f8-4a27-93b5-7b4d4e4a5c91/
    │       ├── lesson.json
    │       └── learning-state.json
    └── assets/
```

目录名不依赖可变的课程名称。课程名称只写在 `manifest.json` 或 `metadata.json` 中，用于界面显示。

当前阶段不要求用户在 Finder 中看到真实目录。插件可以先使用本地结构化存储表达同样的逻辑边界；如果未来需要导出、导入或离线资源包，再实现真实课程目录。

## 未来资源边界

课程核心配置与大资源分离：

```text
课程核心
├── courseId
├── title
├── goal
└── lessons[]
    ├── lessonId
    ├── title
    ├── videoRef
    └── nodes

课程资源
├── assetId
├── type
├── mimeType
├── size
├── checksum
└── storageRef
```

课程节点只引用 `assetId`，不直接把图片、音频或其他大文件塞进课程身份结构。资源可以归属于课程或具体课节，实际存储位置以后可以根据规模选择本地缓存、导出课程包或远程对象存储。

本轮非目标：

- 不实现图片上传；
- 不实现音频上传；
- 不申请额外的大容量存储权限；
- 不实现用户可见的真实课程目录；
- 不实现图片/音频驱动的完整多课程资源 UI；
- 本设计本身不定义插件运行时交互细节，运行时接入由实施计划负责。

## 与现有系统的关系

当前实现已经用以下边界替换“从 `platform:videoId` 推导 `courseId`”：

```text
courseId  ← 后台 Course.id
lessonId  ← 后台 Lesson.id
videoRef  ← 课节用于 B 站页面匹配
nodes     ← 课节的互动节点
```

测试期内没有正式发布的旧版课程，因此不保留旧标识、不读取旧 key、不转换旧响应。发现
旧单课程结构时直接拒绝，由测试数据重新生成 v2 课程包。

后端一对多底层已经完成：

- `Course.lessons` 为正式关系；新发布和授权代码不得读取 `Course.lesson`；
- 已移除 `LessonLimitReached` 和数据库唯一约束；
- 草稿仍按课节保存；课程发布包聚合并发布全部课节；
- 授权码继续绑定课程，而不是绑定单独的 BVID；
- 示例课程使用一门课节验证流程，但数据结构保持 `course -> lessons[]`。

## 方案比较

### 方案 A：使用课程名称或学习目标生成 ID

放弃。名称可能重复，目标可能修改，纯文本 slug 不能提供可靠的全局唯一性。

### 方案 B：使用视频 ID 生成课程 ID

放弃。两门课程可能使用同一个视频，视频身份和课程身份不是同一层对象。

### 方案 C：后台 UUID 作为课程 ID，名称和目标作为可变元数据

采用。身份稳定、唯一性边界清晰，也不限制未来课程改名、换视频或增加资源。

## 验收标准

设计实现时至少验证：

- 新建课程由后台生成 UUID；
- 同名课程获得不同的 `courseId`；
- 修改课程名称不会改变 `courseId`；
- 修改 BVID 不会改变 `courseId`；
- 一门课程可以包含两个或以上课节；
- 每个课节拥有独立 `lessonId` 和 `videoRef`；
- 两个课节可以绑定不同 B 站视频；
- 授权码下载后得到整门课程及其多个课节；
- 发布包和授权码关联使用后台课程 UUID；
- 课程目录名只使用稳定 `courseId`；
- 插件不再从 BVID 生成新课程的永久 ID；
- 未来多课程状态可以按 `courseId` 独立保存，课节状态再按 `lessonId` 隔离。

## 重新讨论条件

- 需要在多个独立系统之间无数据库协调地确定同一课程 ID；
- 课程 ID 必须由外部业务编号兼容；
- 需要用户直接管理真实本地课程目录；
- 资源规模要求单独的对象存储或离线课程包；
- 需要跨课程共享课节或同一课节独立售卖，重新定义课程、课节和授权边界。
