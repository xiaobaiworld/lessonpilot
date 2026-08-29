# 连续可调互动学习窗口实施计划

> **给实施人员：** 按任务逐项执行，每个任务完成后运行该任务的验证命令并提交一次；代码、接口和文档必须保持同一条兼容链路。

**目标：** 将互动节点的窗口展示从离散大小/位置预设升级为可连续设置的宽高和位置，并让教师编辑器预览、课程包、后端接口和学生插件使用同一套规则。

**架构：** 保留 `presentationHints` 作为互动节点的一部分，不新增窗口配置表。共享 TypeScript 模块负责课程包展示配置的类型、默认值、旧值兼容和几何计算；后端制作/发布模块负责草稿节点局部更新、revision 和完整草稿校验；教师端只在编辑态实时更新本地预览，学生端仍通过发布课程和插件升级获得配置。

**技术栈：** TypeScript、React、Vitest、CSS、FastAPI、Pydantic、SQLAlchemy、Pytest、JSON Schema、现有课程包与插件存储版本门禁。

---

## 现有代码边界

实施前先确认以下文件仍是当前入口：

| 文件 | 当前职责 | 本功能改动方向 |
| --- | --- | --- |
| `v1/web/shared/src/portableContent.ts` | 课程节点和展示提示的共享类型、默认解析 | 增加新数值结构的类型和兼容解析 |
| `v1/web/shared/src/presentationGeometry.ts` | 当前不存在 | 新建纯函数，负责百分比到像素矩形的转换和安全边界 |
| `v1/contracts/schemas/course-package.schema.json` | 发布课程包校验 | 同时允许旧枚举和新数值对象 |
| `v1/contracts/schemas/extension-storage.schema.json` | 插件安装课程存储校验 | 同步允许新节点展示结构 |
| `v1/backend/app/modules/authoring_release/application_service.py` | 草稿校验、保存和发布快照 | 增加展示提示校验和节点局部更新服务 |
| `v1/backend/app/modules/authoring_release/routes.py` | 教师制作/发布 HTTP 路由 | 增加节点展示配置 PUT 路由 |
| `v1/backend/app/modules/authoring_release/schemas.py` | Pydantic 请求/响应模型 | 增加展示配置请求和响应模型 |
| `v1/web/teacher/src/nodes.ts` | 节点默认值和本地检查 | 使用默认数值尺寸和中心位置 |
| `v1/web/teacher/src/components/NodeForm.tsx` | 节点内容编辑和学生端预览 | 用滑块、拖动预览和键盘微调替代离散选项 |
| `v1/web/teacher/src/index.css` | 教师节点预览样式 | 改成按预览容器计算的动态几何样式 |
| `v1/web/teacher/src/api.ts` | 教师端 HTTP 客户端 | 增加节点展示配置局部更新方法 |
| `v1/extension/content/window.ts` | 学生互动窗口 DOM 渲染 | 应用共享几何规则和内容增长边界 |
| `v1/extension/content/window.css` | 学生互动窗口 Shadow DOM 样式 | 删除固定右下角和离散 class 依赖 |
| `v1/extension/content/richText.ts` | 学生富文本安全处理和旧展示解析出口 | 改为调用共享新解析器 |
| `v1/extension/storage/index.ts` | 插件本地课程结构校验 | 同步兼容新展示结构 |
| `v1/contracts/version-manifest.ts`、`v1/contracts/versions.json` | 跨客户端版本和支持矩阵 | 提升受影响契约的 minor 版本 |
| `doc/design/v1/06-interface-contracts.md` | HTTP 端点清单 | 先登记新增端点，再实现路由 |

不修改数据库迁移、`v1/extension/background/service-worker.ts` 或学生学习记录结构；本功能没有实时推送通道，也没有学生端后端写入。

## 版本和兼容冻结

实施中使用以下版本组合：

| 契约 | 当前 | 本次实现后 | 原因 |
| --- | --- | --- | --- |
| HTTP API | `2.1.0` | `2.2.0` | 增加节点展示配置局部更新端点 |
| Course Package | `3.1.0` | `3.2.0` | 增加可选的新数值展示结构，旧结构仍可读 |
| Extension Storage | `2.2.0` | `2.3.0` | 已安装课程节点结构允许新展示字段 |
| Extension Messages | `2.2.0` | `2.2.0` | 不改变插件内部消息 |

新写入格式固定为：

```json
{
  "presentationHints": {
    "windowSize": { "widthPercent": 40, "heightPercent": 30 },
    "windowPosition": { "xPercent": 50, "yPercent": 50 },
    "windowStyle": "document"
  }
}
```

兼容读取固定为：

```text
s              -> 30% x 20%
m              -> 40% x 30%
l              -> 55% x 42%
overlay        -> 66% x 66%
bottom-left    -> 20% x 78%
bottom-right   -> 80% x 78%
center         -> 50% x 50%
```

新配置的宽高范围为 `10–66`，位置坐标为 `0–100`；百分比在保存时保留一位小数。运行时还要按视口边距再次限制，避免窄屏溢出。

---

### Task 1: 先登记 HTTP 端点和契约版本

**Files:**

- Modify: `doc/design/v1/06-interface-contracts.md:274-287`
- Modify: `v1/contracts/schemas/course-package.schema.json:74-82`
- Modify: `v1/contracts/schemas/extension-storage.schema.json:79-94`
- Modify: `v1/contracts/version-manifest.ts:39-76`
- Modify: `v1/contracts/versions.json:4-120`
- Test: `v1/contracts/course-package-schema.test.ts`（若不存在则创建）
- Test: `v1/contracts/storage-schema.test.ts`

- [ ] **Step 1: 登记端点并更新清单基线**

在 `doc/design/v1/06-interface-contracts.md` 的教师制作端点表中登记：

```text
PUT /api/v1/teacher/lessons/{lesson_id}/draft/nodes/{node_id}/presentation
```

依据写明“节点级展示配置局部更新，带 revision，复用草稿校验”。同时把端点数量从 `41` 改为 `42`，并将 HTTP API 版本写为 `2.2.0`。

- [ ] **Step 2: 修改课程包 Schema**

在 `course-package.schema.json` 的 `definitions` 中加入以下定义，并让 `presentationHints.windowSize`、`presentationHints.windowPosition` 使用 `anyOf` 同时接受旧值和新值：

```json
"windowSizeConfig": {
  "type": "object",
  "additionalProperties": false,
  "required": ["widthPercent", "heightPercent"],
  "properties": {
    "widthPercent": { "type": "number", "minimum": 10, "maximum": 66 },
    "heightPercent": { "type": "number", "minimum": 10, "maximum": 66 }
  }
},
"windowPositionConfig": {
  "type": "object",
  "additionalProperties": false,
  "required": ["xPercent", "yPercent"],
  "properties": {
    "xPercent": { "type": "number", "minimum": 0, "maximum": 100 },
    "yPercent": { "type": "number", "minimum": 0, "maximum": 100 }
  }
}
```

`windowStyle` 仍只允许 `card` 和 `document`，`presentationHints` 仍禁止未知字段。

- [ ] **Step 3: 同步插件存储 Schema**

将 `extension-storage.schema.json` 中节点的展示提示改为与课程包相同的 `anyOf` 结构；不要把旧课程重写成新格式，旧值仍由读取层规范化。

- [ ] **Step 4: 更新版本清单**

同步修改 `version-manifest.ts` 和 `versions.json`：

```text
httpApi          2.2.0
coursePackage    3.2.0
extensionStorage 2.3.0
extensionMessages 2.2.0
```

支持矩阵的同一行必须使用同一组版本；不创建新的数据库迁移名。

- [ ] **Step 5: 运行契约门禁**

运行：

```bash
node tools/endpoint-check.mjs
npm run check:contract
```

预期：契约 Schema 和版本检查通过；由于新增 HTTP 路由尚未实现，此时 endpoint-check 可以只报告一个“清单中已登记但尚未实现”的差异，Task 3 完成后必须重新运行并全绿。

- [ ] **Step 6: 提交**

```bash
git add doc/design/v1/06-interface-contracts.md v1/contracts
git commit -m "docs: register learning window presentation contract"
```

### Task 2: 建立共享展示模型和几何纯函数

**Files:**

- Modify: `v1/web/shared/src/portableContent.ts:20-76`
- Create: `v1/web/shared/src/presentationGeometry.ts`
- Modify: `v1/web/shared/src/index.ts:1-30`
- Modify: `v1/web/shared/src/portableContent.test.ts:50-90`
- Create: `v1/web/shared/src/presentationGeometry.test.ts`
- Modify: `v1/extension/content/richText.ts:1-10,204-210`

- [ ] **Step 1: 写共享模型失败测试**

在 `portableContent.test.ts` 增加以下行为测试：

```ts
it('解析新数值展示配置并保留一位小数', () => {
  expect(resolvePresentationHints({
    windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
    windowPosition: { xPercent: 63.4, yPercent: 28.7 },
    windowStyle: 'document',
  })).toEqual({
    size: { widthPercent: 42.5, heightPercent: 31.2 },
    position: { xPercent: 63.4, yPercent: 28.7 },
    style: 'document',
  });
});

it('旧枚举被明确映射，新字段越界回退到默认值', () => {
  expect(resolvePresentationHints({
    windowSize: 'm',
    windowPosition: 'bottom-right',
  })).toEqual({
    size: { widthPercent: 40, heightPercent: 30 },
    position: { xPercent: 80, yPercent: 78 },
    style: 'card',
  });
  expect(resolvePresentationHints({
    windowSize: { widthPercent: 99, heightPercent: 5 },
    windowPosition: { xPercent: -1, yPercent: 101 },
  })).toEqual({
    size: { widthPercent: 40, heightPercent: 30 },
    position: { xPercent: 50, yPercent: 50 },
    style: 'document',
  });
});
```

- [ ] **Step 2: 写几何失败测试**

在 `presentationGeometry.test.ts` 增加：

```ts
it('按视口百分比计算中心点矩形', () => {
  expect(resolvePresentationGeometry(
    { size: { widthPercent: 40, heightPercent: 30 }, position: { xPercent: 50, yPercent: 50 }, style: 'document' },
    { width: 1000, height: 800 },
  )).toEqual({ left: 300, top: 280, width: 400, height: 240 });
});

it('尺寸和位置会被安全边界限制', () => {
  expect(resolvePresentationGeometry(
    { size: { widthPercent: 66, heightPercent: 66 }, position: { xPercent: 0, yPercent: 100 }, style: 'card' },
    { width: 320, height: 240 },
  )).toEqual({ left: 16, top: 66, width: 211, height: 158 });
});
```

- [ ] **Step 3: 运行失败测试**

运行：

```bash
npm --prefix v1 test -- --run web/shared/src/portableContent.test.ts web/shared/src/presentationGeometry.test.ts
```

预期：新测试因类型、解析器和几何函数尚不存在而失败。

- [ ] **Step 4: 写共享类型和解析器**

在 `portableContent.ts` 中把旧类型拆成明确的联合类型：

```ts
export interface WindowSizeConfig {
  widthPercent: number;
  heightPercent: number;
}

export interface WindowPositionConfig {
  xPercent: number;
  yPercent: number;
}

export type LegacyWindowSize = 's' | 'm' | 'l' | 'overlay';
export type LegacyWindowPosition = 'bottom-left' | 'bottom-right' | 'center';

export interface PresentationHints {
  windowSize?: WindowSizeConfig | LegacyWindowSize;
  windowStyle?: WindowStyle;
  windowPosition?: WindowPositionConfig | LegacyWindowPosition;
}

export interface ResolvedPresentationHints {
  size: WindowSizeConfig;
  style: WindowStyle;
  position: WindowPositionConfig;
}
```

将默认值、范围和旧值映射集中放在同一文件，并让 `resolvePresentationHints()` 返回完整的新结构。非法对象不得部分合并；尺寸或坐标对象任一字段非法时，整组回退到默认值。

- [ ] **Step 5: 写几何函数**

在 `presentationGeometry.ts` 中只放无 DOM 依赖的函数：

```ts
export interface PresentationViewport { width: number; height: number }
export interface PresentationRect { left: number; top: number; width: number; height: number }

export function resolvePresentationGeometry(
  hints: ResolvedPresentationHints,
  viewport: PresentationViewport,
  safeMargin = 16,
): PresentationRect;

export function percentFromPreviewPoint(
  point: { x: number; y: number },
  viewport: PresentationViewport,
): WindowPositionConfig;
```

函数必须先限制视口和百分比为有限非负数，再计算尺寸、中心点和安全边界；窄屏时将可用尺寸限制为 `viewport - safeMargin * 2`。结果按像素取整，输入百分比按一位小数规范化。

- [ ] **Step 6: 统一插件旧解析出口**

删除 `richText.ts` 中只返回 `size/style/position` 旧枚举的本地包装类型，让 `resolveWindowPresentation()` 直接返回共享 `ResolvedPresentationHints`。保留函数名作为插件内部兼容出口，避免一次性修改所有调用点。

- [ ] **Step 7: 运行共享测试并提交**

运行：

```bash
npm --prefix v1 test -- --run web/shared/src/portableContent.test.ts web/shared/src/presentationGeometry.test.ts extension/content/richText.test.ts
npm --prefix v1 run type-check
```

预期：共享解析、旧值兼容、几何边界和现有富文本测试通过。

```bash
git add v1/web/shared/src v1/extension/content/richText.ts
git commit -m "feat: add continuous presentation geometry"
```

### Task 3: 后端增加节点展示配置服务端口

**Files:**

- Modify: `v1/backend/app/modules/authoring_release/schemas.py:24-46`
- Modify: `v1/backend/app/modules/authoring_release/application_service.py:39-49,400-449,523-568`
- Modify: `v1/backend/app/modules/authoring_release/routes.py:17-31,294-330`
- Create: `v1/backend/tests/test_node_presentation_api.py`
- Modify: `v1/backend/tests/test_draft_window_display.py`

- [ ] **Step 1: 写 Pydantic 和服务失败测试**

新增 API 测试固定以下请求和结果：

```python
payload = {
    "revision": 1,
    "presentationHints": {
        "windowSize": {"widthPercent": 42.5, "heightPercent": 31.2},
        "windowPosition": {"xPercent": 63.4, "yPercent": 28.7},
        "windowStyle": "document",
    },
}
response = client.put(
    f"/api/v1/teacher/lessons/{lesson_id}/draft/nodes/{node_id}/presentation",
    json=payload,
)
assert response.status_code == 200
assert response.json()["revision"] == 2
assert response.json()["presentationHints"] == payload["presentationHints"]
```

同时固定四个失败行为：宽度小于 `10`、高度大于 `66`、坐标超出 `0–100` 返回 `422 DRAFT_NODE_PRESENTATION_INVALID`；revision 过期返回 `409 REVISION_CONFLICT` 且草稿内容和 revision 都不变化；节点不存在返回 `404`。

- [ ] **Step 2: 运行后端失败测试**

运行：

```bash
cd v1/backend && uv run pytest tests/test_node_presentation_api.py -q
```

预期：模型、路由和应用服务尚不存在，测试失败。

- [ ] **Step 3: 增加请求/响应模型**

在 `schemas.py` 增加禁止额外字段、使用 camelCase alias 的模型：

```python
class WindowSizeWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    width_percent: float = Field(alias="widthPercent", ge=10, le=66)
    height_percent: float = Field(alias="heightPercent", ge=10, le=66)


class WindowPositionWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    x_percent: float = Field(alias="xPercent", ge=0, le=100)
    y_percent: float = Field(alias="yPercent", ge=0, le=100)


class PresentationHintsWrite(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    window_size: WindowSizeWrite = Field(alias="windowSize")
    window_position: WindowPositionWrite = Field(alias="windowPosition")
    window_style: Literal["card", "document"] = Field(alias="windowStyle")


class NodePresentationWrite(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)
    presentation_hints: PresentationHintsWrite = Field(alias="presentationHints")


class NodePresentationPublic(BaseModel):
    lesson_id: str
    node_id: str
    revision: int
    presentation_hints: dict = Field(alias="presentationHints")

    model_config = ConfigDict(populate_by_name=True)
```

- [ ] **Step 4: 增加共享后端校验函数**

在 `application_service.py` 集中定义 `validate_presentation_hints(value: object) -> dict`，接受新格式的四个数值和样式，拒绝布尔值、非有限数、越界数、额外字段和未知样式，错误统一抛出 `AuthoringReleaseError("DRAFT_NODE_PRESENTATION_INVALID")`。`validate_config()` 对整份草稿调用该函数，因此整份保存和局部更新使用同一规则；旧字符串仍由兼容分支接受。

- [ ] **Step 5: 增加原子局部更新服务**

在 `AuthoringReleaseApplicationService` 增加：

```python
def update_node_presentation(
    self,
    teacher_id: str,
    lesson_id: str,
    node_id: str,
    revision: int,
    presentation_hints: dict,
) -> tuple[int, dict]:
    """按 revision 原子替换一个草稿节点的展示配置。"""
```

实现顺序固定为：读取草稿 → 比较 revision → 查找节点 → 校验新展示配置 → 复制节点列表并只替换 `presentationHints` → 用 `validate_config()` 校验更新后的完整配置 → 更新 digest、revision、保存教师并提交。任一步失败都不得提交部分修改。

- [ ] **Step 6: 增加路由和错误映射**

在现有 `save_draft` 路由后增加：

```python
@router.put(
    "/lessons/{lesson_id}/draft/nodes/{node_id}/presentation",
    response_model=NodePresentationPublic,
)
def update_node_presentation(
    lesson_id: str,
    node_id: str,
    payload: NodePresentationWrite,
    teacher: TeacherAccount = Depends(require_teacher),
    db: Session = Depends(get_db),
) -> NodePresentationPublic:
    courses, authoring = _services(db)
    try:
        courses.get_lesson(teacher.id, lesson_id)
        revision, hints = authoring.update_node_presentation(
            teacher.id,
            lesson_id,
            node_id,
            payload.revision,
            payload.presentation_hints.model_dump(by_alias=True),
        )
        return NodePresentationPublic(
            lesson_id=lesson_id,
            node_id=node_id,
            revision=revision,
            presentationHints=hints,
        )
    except (WorkspaceCourseError, AuthoringReleaseError) as error:
        raise _error(error) from error
```

把 `DRAFT_NODE_PRESENTATION_INVALID` 加入 `AUTHORING_ERROR_MESSAGES`；让 `_error()` 保持 422 映射，revision 冲突继续由现有 409 映射处理。

- [ ] **Step 7: 运行后端测试和端点检查**

运行：

```bash
cd v1/backend
uv run pytest tests/test_node_presentation_api.py tests/test_draft_window_display.py -q
uv run ruff check .
uv run ruff format --check .
cd ../..
node tools/endpoint-check.mjs
```

预期：接口、完整草稿保存、非法数据、revision 冲突和端点清单全部通过。

- [ ] **Step 8: 提交**

```bash
git add v1/backend/app/modules/authoring_release v1/backend/tests
git commit -m "feat: add node presentation update endpoint"
```

### Task 4: 教师端默认值、滑块和拖动预览

**Files:**

- Modify: `v1/web/teacher/src/nodes.ts:1-60,70-135`
- Modify: `v1/web/teacher/src/components/NodeForm.tsx:1-274,276-393`
- Modify: `v1/web/teacher/src/index.css:1003-1140,1316-1385,1420-1435`
- Modify: `v1/web/teacher/src/api.ts:245-263`
- Create: `v1/web/teacher/src/components/PresentationPreview.tsx`
- Create: `v1/web/teacher/src/components/PresentationPreview.test.tsx`
- Modify: `v1/web/teacher/src/nodes.test.ts:1-40`

- [ ] **Step 1: 写默认值和预览行为测试**

更新 `nodes.test.ts`：

```ts
expect(node.presentationHints).toEqual({
  windowSize: { widthPercent: 40, heightPercent: 30 },
  windowPosition: { xPercent: 50, yPercent: 50 },
  windowStyle: 'document',
});
```

新增组件测试固定：滑块改变宽高；拖动预览更新 `xPercent/yPercent`；方向键每次调整 `0.5`；重置按钮恢复 `40/30/50/50`；`disabled` 时滑块、拖动和按钮不可操作。

- [ ] **Step 2: 运行失败测试**

运行：

```bash
npm --prefix v1 test -- --run web/teacher/src/nodes.test.ts web/teacher/src/components/PresentationPreview.test.tsx
```

预期：新默认对象和新预览组件测试失败。

- [ ] **Step 3: 更新节点默认值和表单状态**

在 `nodes.ts` 中集中定义：

```ts
export const WINDOW_DEFAULTS = {
  windowSize: { widthPercent: 40, heightPercent: 30 },
  windowStyle: 'document' as const,
  windowPosition: { xPercent: 50, yPercent: 50 },
};
```

`changeNodeKind()` 保留已有 `presentationHints`；旧值从服务端加载后由共享 `resolvePresentationHints()` 规范化，再交给表单。不要继续在 `NodeForm.tsx` 内维护大小/位置选项数组。

- [ ] **Step 4: 增加预览组件**

`PresentationPreview.tsx` 只负责预览区域的尺寸、位置和指针/键盘输入，接口固定为：

```ts
interface PresentationPreviewProps {
  hints: PresentationHints;
  disabled: boolean;
  children: React.ReactNode;
  onChange: (patch: Partial<PresentationHints>) => void;
}
```

实现规则：预览舞台通过 `ref` 读取自身 `getBoundingClientRect()`；指针按下时保存初始点和初始中心百分比；移动时把像素位移换算为百分比并限制在安全边界；释放时清理拖动状态。窗口设置 `role="button"`、`tabIndex={0}` 和明确的 aria label；方向键每次改变 `0.5`，Home/End 分别把对应轴设为安全边界起点/终点。

- [ ] **Step 5: 增加连续控件**

在 `NodeForm.tsx` 的“预览设置”中替换旧 `ChoiceGroup`：

```tsx
<label className="preview-range-row">
  <span>宽度 {widthPercent.toFixed(1)}%</span>
  <input
    type="range"
    min="10"
    max="66"
    step="0.1"
    value={widthPercent}
    onChange={(event) => onChange({ windowSize: {
      ...windowSize,
      widthPercent: Number(event.currentTarget.value),
    }})}
  />
</label>
```

高度使用同样结构；位置显示 X/Y 百分比但由拖动和键盘修改；保留样式选择、预览确认和重置位置按钮。每次本地修改只调用 `onChange`，不调用网络。

- [ ] **Step 6: 让 CSS 使用动态几何**

预览舞台保留视频背景，但 `.student-node-card` 不再依赖 `student-node-preview-s/m/l/overlay` 和 `bottom-left/bottom-right/center` class。组件通过 CSS custom properties 写入 `--preview-left`、`--preview-top`、`--preview-width`、`--preview-height`，CSS 只负责：

```css
.student-node-card {
  position: absolute;
  left: var(--preview-left);
  top: var(--preview-top);
  width: var(--preview-width);
  min-height: var(--preview-height);
  max-width: calc(100% - 32px);
  max-height: calc(100% - 32px);
  overflow: auto;
  box-sizing: border-box;
}
```

内容默认 `overflow-wrap: anywhere`，媒体 `max-width: 100%`，确保内容增长不会把预览舞台撑出边界。

- [ ] **Step 7: 增加 API 客户端方法但不绑定拖动事件**

在 `api.ts` 增加类型和客户端方法：

```ts
export interface NodePresentationPublic {
  lessonId: string;
  nodeId: string;
  revision: number;
  presentationHints: PresentationHints;
}

updateNodePresentation(
  lessonId: string,
  nodeId: string,
  revision: number,
  presentationHints: PresentationHints,
): Promise<NodePresentationPublic>;
```

该方法用于节点展示配置局部更新能力和后续显式保存场景；本轮编辑器仍遵守“拖动/滑块只改本地，页面保存草稿时整份提交”的保存边界，避免拖动造成 revision 风暴和局部接口覆盖整份草稿。

- [ ] **Step 8: 运行教师端测试和类型检查**

运行：

```bash
npm --prefix v1 test -- --run web/teacher/src/nodes.test.ts web/teacher/src/components/PresentationPreview.test.tsx web/teacher/src/api.test.ts
npm --prefix v1 run type-check
```

预期：默认值、滑块、拖动、键盘、禁用态和 API 类型测试通过。

- [ ] **Step 9: 提交**

```bash
git add v1/web/teacher/src
git commit -m "feat: add continuous teacher presentation preview"
```

### Task 5: 学生插件应用动态窗口几何和内容增长

**Files:**

- Modify: `v1/extension/content/window.ts:1-90`
- Modify: `v1/extension/content/window.css:15-80,99-110`
- Modify: `v1/extension/content/richText.ts:1-10,204-210`
- Modify: `v1/extension/storage/index.ts:220-255`
- Modify: `v1/extension/content/window.test.ts:38-100`
- Modify: `v1/extension/content/richText.test.ts:73-98`
- Create: `v1/extension/content/presentationGeometry.test.ts`

- [ ] **Step 1: 写插件几何失败测试**

在 `window.test.ts` 增加新格式节点：

```ts
view.render({
  kind: 'open',
  node: notice({
    windowSize: { widthPercent: 42.5, heightPercent: 31.2 },
    windowPosition: { xPercent: 63.4, yPercent: 28.7 },
    windowStyle: 'document',
  }),
  draft: '',
});

const panel = document
  .getElementById('knownmap-learning-window')!
  .shadowRoot!
  .querySelector<HTMLElement>('.km-panel')!;
expect(panel.style.getPropertyValue('--km-width-percent')).toBe('42.5');
expect(panel.style.getPropertyValue('--km-height-percent')).toBe('31.2');
expect(panel.style.getPropertyValue('--km-x-percent')).toBe('63.4');
expect(panel.style.getPropertyValue('--km-y-percent')).toBe('28.7');
```

保留旧枚举测试，但断言改为新几何 CSS 变量和默认居中值，不再断言旧 `km-size-*`、`km-position-*` class。

- [ ] **Step 2: 运行插件失败测试**

运行：

```bash
npm --prefix v1 test -- --run extension/content/window.test.ts extension/content/richText.test.ts extension/storage/storage.test.ts
```

预期：新格式没有被窗口应用，旧 class 断言需要迁移。

- [ ] **Step 3: 在窗口渲染中应用共享解析和 CSS 变量**

`LearningWindow.render()` 继续只负责 DOM 生命周期和节点内容；它调用 `resolveWindowPresentation()` 后，将新结构写成受控 CSS 变量：

```ts
panel.style.setProperty('--km-width-percent', String(presentation.size.widthPercent));
panel.style.setProperty('--km-height-percent', String(presentation.size.heightPercent));
panel.style.setProperty('--km-x-percent', String(presentation.position.xPercent));
panel.style.setProperty('--km-y-percent', String(presentation.position.yPercent));
```

不能把课程包字段直接拼接成 CSS 属性名或 CSS 规则；只允许写入经过共享解析和范围限制后的数字。

- [ ] **Step 4: 调整插件 CSS 的基础布局**

`.km-panel` 使用共享 `resolvePresentationGeometry()` 的像素矩形，保留 `position: fixed`、Shadow DOM、z-index、样式主题和安全边距；移除固定 `right: 24px`、`bottom: 76px` 以及四套离散位置 class。组件只把经过共享计算的 `left/top/width/minHeight` 写入受控 CSS custom properties，CSS 不负责重新解释课程包百分比。

```css
.km-panel {
  position: fixed;
  left: var(--km-left);
  top: var(--km-top);
  width: var(--km-width);
  min-height: var(--km-min-height);
  max-width: calc(100vw - 32px);
  max-height: calc(100vh - 32px);
  overflow: auto;
}
```

- [ ] **Step 5: 实现内容增长边界**

窗口初始尺寸使用基础宽高；内容插入和资源加载完成后，用一个明确命名的 `ResizeObserver` 观察内容区域，计算内容所需尺寸并执行：

```text
actualWidth  = min(max(baseWidth, contentWidth + horizontalPadding), viewportWidth - 32px)
actualHeight = min(max(baseHeight, contentHeight + verticalPadding), viewportHeight - 32px)
```

达到视口上限后保留 `overflow: auto`。观察器只更新当前 render generation 的 panel，销毁窗口时解除观察，避免异步资源回调写入旧窗口。

- [ ] **Step 6: 同步插件存储校验**

在 `isPortableNode()` 的展示提示校验中接受两种结构：旧字符串和新对象。新对象必须满足完整字段、有限数字、范围和无额外字段；不在存储读取时静默接受未知字段。课程包校验失败仍进入现有 quarantine 流程。

- [ ] **Step 7: 运行插件测试和构建**

运行：

```bash
npm --prefix v1 test -- --run extension/content/window.test.ts extension/content/richText.test.ts extension/content/presentationGeometry.test.ts extension/storage/storage.test.ts
npm --prefix v1 run type-check
npm --prefix v1 run build:extension
```

预期：新格式、旧课程、默认值、窄屏、安全边界、资源加载后尺寸更新和窗口销毁测试通过；插件构建产物生成成功。

- [ ] **Step 8: 提交**

```bash
git add v1/extension/content v1/extension/storage
git commit -m "feat: apply continuous learning window geometry"
```

### Task 6: 课程发布链路和教师/插件一致性验证

**Files:**

- Modify: `v1/backend/tests/test_authoring_release_api.py:58-140`
- Modify: `v1/backend/tests/test_entitlement_delivery_api.py:1-80`
- Modify: `v1/extension/runtime/course-upgrade.test.ts:1-240`
- Modify: `v1/contracts/release-gate.test.ts:110-135`
- Modify: `doc/INDEX.md`
- Modify: `doc/lessons.md`（仅在本阶段有新坑时写入；没有新经验则在提交说明中明确无新增）

- [ ] **Step 1: 写发布快照测试**

在现有发布测试中创建带新展示配置的草稿，发布后断言不可变 release snapshot 中仍包含同一数值结构；再修改草稿，断言已发布快照不变。

- [ ] **Step 2: 写插件升级兼容测试**

覆盖两条课程升级路径：旧课程只含字符串展示提示时升级后仍可打开；新课程含数值展示提示时下载、安装、重启后仍保留一位小数的宽高和位置。

- [ ] **Step 3: 写发布闸门测试**

断言支持矩阵接受 `httpApi=2.2.0`、`coursePackage=3.2.0`、`extensionStorage=2.3.0` 的完整组合；缺少任一对应版本时闸门拒绝切换。

- [ ] **Step 4: 运行跨层验证**

运行：

```bash
cd v1/backend && uv run pytest
uv run ruff check .
uv run ruff format --check .
cd ../..
npm test
npm run check
npm run check:contract
node tools/endpoint-check.mjs
node tools/v1-module-check.mjs
node tools/secret-scan.mjs
```

预期：后端、前端、插件、文档、契约、端点、模块和秘密扫描全部通过。

- [ ] **Step 5: 完成浏览器人工验收**

在教师端逐个验证：

```text
默认 40% x 30% 居中
宽高从 10% 拖到 66%，预览尺寸连续变化
窗口拖到四角仍保留安全边距
方向键每次 0.5% 微调
长文本换行，媒体不溢出
内容超出基础高度后窗口增长，达到上限后内部滚动
取消编辑不改变草稿
保存草稿后刷新仍保留配置
```

在 Chrome 插件中验证普通 B 站页面、全屏播放器和窄屏视口；确认新窗口不再固定在右下角，内容增长和滚动与教师预览的语义一致。

- [ ] **Step 6: 更新索引和状态**

在 `doc/INDEX.md` 将设计/实施计划标记为已实现或当前权威状态；同步 `next.md`、`changelog.md` 和版本清单。若没有新增经验，在提交说明中写明“本阶段无新增 lessons”，不要为了形式添加空条目。

- [ ] **Step 7: 最终检查和提交**

运行：

```bash
node tools/doc-check.mjs
git diff --check
git status --short
```

预期：文档四项检查全绿、没有空白错误，工作树只包含计划中允许的变更。

```bash
git add doc/INDEX.md next.md changelog.md doc/lessons.md v1/contracts
git commit -m "docs: close continuous learning window rollout"
```

## 实施顺序和暂停点

必须按 Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 执行。每个任务的测试和提交通过后再进入下一个任务。

以下情况必须暂停并重新评审，而不是用兼容分支掩盖：

- 课程包无法同时读取旧枚举和新数值对象；
- 现有发布快照会因草稿更新而改变；
- 教师预览和插件视口计算只能通过复制两套不同规则才能一致；
- 需要新增数据库表或实时推送才能满足当前设计；
- 现有版本闸门无法表达 HTTP API、课程包和插件存储的兼容组合。

## 自审结果

- 设计文档第 1–3 节由 Task 1、Task 2 和 Task 5 覆盖：数值模型、默认值、10%–66% 范围、位置坐标、安全边界和内容增长。
- 设计文档第 4 节由 Task 4 覆盖：连续滑块、预览拖动、键盘微调、实时本地预览和保存边界。
- 设计文档第 5 节由 Task 3 覆盖：节点级 PUT、权限、revision、422/409/404 和原子更新。
- 设计文档第 6–7 节由 Task 2、Task 5 和 Task 6 覆盖：共享解析、旧值兼容、发布快照和插件升级。
- 设计文档第 8–10 节由所有任务覆盖：代码清单、方案二、可读性原则和验收标准。
- 全文没有未定义的实现占位；类型名称、字段名称和版本号在各任务中保持一致。
