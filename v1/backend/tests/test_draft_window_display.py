import pytest

from app.modules.authoring_release.application_service import (
    AuthoringReleaseError,
    RICH_BODY_MAX,
    validate_nodes,
)

NOTICE = {
    "id": "node-1",
    "enabled": True,
    "family": "attention",
    "interaction": "notice",
    "trigger": {"kind": "time_cross", "timeSeconds": 12},
    "display": {"title": "重点", "richBody": "<p>记住这一点</p>"},
    "evaluation": None,
    "effects": {"pause": True},
}

CHOICE = {
    "id": "node-2",
    "enabled": True,
    "family": "practice",
    "interaction": "choice",
    "trigger": {"kind": "time_cross", "timeSeconds": 20},
    "display": {
        "title": "选择题",
        "prompt": "哪一个更具体？",
        "options": [
            {"id": "a", "label": "品质"},
            {"id": "b", "label": "经历"},
        ],
    },
    "evaluation": {"answer": "b", "explanation": "具体经历能验证。"},
    "effects": {"pause": True},
}


def test_accepts_window_presets_and_question_rich_body() -> None:
    nodes = [
        {
            **NOTICE,
            "display": {
                **NOTICE["display"],
                "windowSize": "l",
                "windowStyle": "document",
            },
        },
        {
            **CHOICE,
            "display": {
                **CHOICE["display"],
                "richBody": "<p>看图再选</p>",
                "windowSize": "m",
                "windowStyle": "card",
            },
        },
    ]
    assert validate_nodes(nodes) == nodes


def test_legacy_choice_with_only_prompt_still_saves() -> None:
    assert validate_nodes([CHOICE])[0]["display"]["prompt"] == "哪一个更具体？"


def test_rejects_illegal_window_size() -> None:
    with pytest.raises(AuthoringReleaseError) as error:
        validate_nodes(
            [
                {
                    **NOTICE,
                    "display": {**NOTICE["display"], "windowSize": "huge"},
                }
            ]
        )
    assert error.value.code == "DRAFT_NODE_CONTENT_INVALID"


def test_rejects_oversized_rich_body() -> None:
    with pytest.raises(AuthoringReleaseError) as error:
        validate_nodes(
            [
                {
                    **NOTICE,
                    "display": {
                        "title": "重点",
                        "richBody": "字" * (RICH_BODY_MAX + 1),
                    },
                }
            ]
        )
    assert error.value.code == "DRAFT_NODE_CONTENT_INVALID"
