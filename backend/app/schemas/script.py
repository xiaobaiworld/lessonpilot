import math
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


_ID_PATTERN = re.compile(r"^[\x21-\x7e]+$")


def _validate_id(value: str) -> str:
    if not value.strip() or len(value) > 80 or _ID_PATTERN.fullmatch(value) is None:
        raise ValueError("必须是 1-80 个可打印 ASCII 字符。")
    return value


def _validate_text(value: str) -> str:
    if not value.strip():
        raise ValueError("文本不能为空。")
    return value


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)


class ScriptTrigger(StrictModel):
    kind: Literal["time_cross"]
    time_seconds: float = Field(alias="timeSeconds", ge=0)
    caption_id: str | None = Field(default=None, alias="captionId")

    @field_validator("time_seconds")
    @classmethod
    def validate_time(cls, value: float) -> float:
        if not math.isfinite(value):
            raise ValueError("触发时间必须是有限数字。")
        return value

    @field_validator("caption_id")
    @classmethod
    def validate_caption_id(cls, value: str | None) -> str | None:
        return _validate_id(value) if value is not None else value


class ScriptEffects(StrictModel):
    pause: Literal[True]


class NoticeHighlight(StrictModel):
    text: str

    _text = field_validator("text")(_validate_text)


class NoticeSummarySection(StrictModel):
    label: str
    body: str

    _label = field_validator("label")(_validate_text)
    _body = field_validator("body")(_validate_text)


class NoticeSummary(StrictModel):
    title: str
    body: str

    _title = field_validator("title")(_validate_text)
    _body = field_validator("body")(_validate_text)


class NoticeDisplay(StrictModel):
    title: str
    body: str
    caption_quote: str | None = Field(default=None, alias="captionQuote")
    highlights: list[NoticeHighlight] | None = None
    eyebrow: str | None = None
    intro: str | None = None
    sections: list[NoticeSummarySection] | None = Field(default=None, min_length=3, max_length=3)
    summary: NoticeSummary | None = None

    _title = field_validator("title")(_validate_text)
    _body = field_validator("body")(_validate_text)

    @field_validator("eyebrow", "intro")
    @classmethod
    def validate_optional_text(cls, value: str | None) -> str | None:
        return _validate_text(value) if value is not None else value

    @model_validator(mode="after")
    def validate_structured_summary(self) -> "NoticeDisplay":
        structured = [self.eyebrow, self.intro, self.sections, self.summary]
        if any(value is not None for value in structured) and not all(
            value is not None for value in structured
        ):
            raise ValueError("重点提示的结构化字段必须一起填写。")
        return self


class ChoiceOption(StrictModel):
    id: str
    label: str

    _id = field_validator("id")(_validate_id)
    _label = field_validator("label")(_validate_text)


class ChoiceDisplay(StrictModel):
    title: str
    prompt: str
    options: list[ChoiceOption] = Field(min_length=2, max_length=8)

    _title = field_validator("title")(_validate_text)
    _prompt = field_validator("prompt")(_validate_text)

    @model_validator(mode="after")
    def validate_option_ids(self) -> "ChoiceDisplay":
        ids = [option.id for option in self.options]
        if len(ids) != len(set(ids)):
            raise ValueError("选项 ID 必须唯一。")
        return self


class ChoiceEvaluation(StrictModel):
    answer: str
    explanation: str

    _answer = field_validator("answer")(_validate_id)

    @field_validator("explanation")
    @classmethod
    def validate_explanation(cls, value: str) -> str:
        return _validate_text(value)


class BlankDisplay(StrictModel):
    title: str
    prompt: str

    _title = field_validator("title")(_validate_text)
    _prompt = field_validator("prompt")(_validate_text)


class BlankEvaluation(StrictModel):
    accepted_answers: list[str] = Field(alias="acceptedAnswers", min_length=1, max_length=20)
    normalize: list[Literal["trim", "casefold"]]
    explanation: str

    @field_validator("accepted_answers")
    @classmethod
    def validate_answers(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values]
        if any(not value for value in cleaned):
            raise ValueError("可接受答案不能为空。")
        normalized = [value.casefold() for value in cleaned]
        if len(normalized) != len(set(normalized)):
            raise ValueError("可接受答案不能重复。")
        return cleaned

    @field_validator("normalize")
    @classmethod
    def validate_normalize(cls, values: list[str]) -> list[str]:
        if values != ["trim", "casefold"]:
            raise ValueError("填空题只允许按 trim、casefold 顺序规范化。")
        return values

    @field_validator("explanation")
    @classmethod
    def validate_explanation(cls, value: str) -> str:
        return _validate_text(value)


class FreeTextDisplay(StrictModel):
    title: str
    prompt: str

    _title = field_validator("title")(_validate_text)
    _prompt = field_validator("prompt")(_validate_text)


class FreeTextEvaluation(StrictModel):
    reference_feedback: str = Field(alias="referenceFeedback")

    _reference_feedback = field_validator("reference_feedback")(_validate_text)


class NoticeNode(StrictModel):
    id: str
    enabled: bool
    family: Literal["attention"]
    interaction: Literal["notice"]
    trigger: ScriptTrigger
    display: NoticeDisplay
    evaluation: None
    effects: ScriptEffects

    _id = field_validator("id")(_validate_id)


class ChoiceNode(StrictModel):
    id: str
    enabled: bool
    family: Literal["practice"]
    interaction: Literal["choice"]
    trigger: ScriptTrigger
    display: ChoiceDisplay
    evaluation: ChoiceEvaluation
    effects: ScriptEffects

    _id = field_validator("id")(_validate_id)

    @model_validator(mode="after")
    def validate_answer(self) -> "ChoiceNode":
        if self.evaluation.answer not in {option.id for option in self.display.options}:
            raise ValueError("选择题答案必须引用已有选项。")
        return self


class BlankNode(StrictModel):
    id: str
    enabled: bool
    family: Literal["practice"]
    interaction: Literal["blank"]
    trigger: ScriptTrigger
    display: BlankDisplay
    evaluation: BlankEvaluation
    effects: ScriptEffects

    _id = field_validator("id")(_validate_id)


class FreeTextNode(StrictModel):
    id: str
    enabled: bool
    family: Literal["followup"]
    interaction: Literal["free_text"]
    trigger: ScriptTrigger
    display: FreeTextDisplay
    evaluation: FreeTextEvaluation
    effects: ScriptEffects

    _id = field_validator("id")(_validate_id)


ScriptNode = Annotated[
    NoticeNode | ChoiceNode | BlankNode | FreeTextNode,
    Field(discriminator="interaction"),
]


class ScriptConfig(StrictModel):
    nodes: list[ScriptNode] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def validate_nodes(self) -> "ScriptConfig":
        ids = [node.id for node in self.nodes]
        if len(ids) != len(set(ids)):
            raise ValueError("节点 ID 必须唯一。")
        order = [(node.trigger.time_seconds, node.id) for node in self.nodes]
        if order != sorted(order):
            raise ValueError("节点必须按触发时间和 ID 升序排列。")
        return self


class ScriptDraftRequest(StrictModel):
    schema_version: Literal[1]
    config: ScriptConfig


class ScriptDraftResponse(ScriptDraftRequest):
    lesson_id: str
    node_count: int
    updated_at: str


def dump_script_config(config: ScriptConfig) -> dict:
    data = config.model_dump(by_alias=True, mode="json", exclude_none=True)
    for node in data["nodes"]:
        if node["interaction"] == "notice":
            node["evaluation"] = None
    return data
