import copy

import pytest
from pydantic import ValidationError

from app.schemas.script import ScriptDraftRequest, dump_script_config


def four_node_request() -> dict:
    return {
        "schema_version": 1,
        "config": {
            "nodes": [
                {
                    "id": "node-1",
                    "enabled": True,
                    "family": "attention",
                    "interaction": "notice",
                    "trigger": {"kind": "time_cross", "timeSeconds": 10, "captionId": None},
                    "display": {"title": "重点", "body": "记住这一句"},
                    "evaluation": None,
                    "effects": {"pause": True},
                },
                {
                    "id": "node-2",
                    "enabled": True,
                    "family": "practice",
                    "interaction": "choice",
                    "trigger": {"kind": "time_cross", "timeSeconds": 20, "captionId": None},
                    "display": {
                        "title": "选择",
                        "prompt": "选出正确答案",
                        "options": [
                            {"id": "a", "label": "答案 A"},
                            {"id": "b", "label": "答案 B"},
                        ],
                    },
                    "evaluation": {"answer": "b", "explanation": "答案 B 正确"},
                    "effects": {"pause": True},
                },
                {
                    "id": "node-3",
                    "enabled": True,
                    "family": "practice",
                    "interaction": "blank",
                    "trigger": {"kind": "time_cross", "timeSeconds": 30, "captionId": None},
                    "display": {"title": "填空", "prompt": "I ____ a solution."},
                    "evaluation": {
                        "acceptedAnswers": ["suggested"],
                        "normalize": ["trim", "casefold"],
                        "explanation": "答案是 suggested",
                    },
                    "effects": {"pause": True},
                },
                {
                    "id": "node-4",
                    "enabled": True,
                    "family": "followup",
                    "interaction": "free_text",
                    "trigger": {"kind": "time_cross", "timeSeconds": 40, "captionId": None},
                    "display": {"title": "问答", "prompt": "请用自己的经历回答"},
                    "evaluation": {"referenceFeedback": "按四个步骤组织回答"},
                    "effects": {"pause": True},
                },
            ]
        },
    }


def test_accepts_all_four_initial_node_types_and_preserves_plugin_field_names() -> None:
    result = ScriptDraftRequest.model_validate(four_node_request())

    dumped = result.model_dump(by_alias=True, mode="json")

    assert [node["interaction"] for node in dumped["config"]["nodes"]] == [
        "notice",
        "choice",
        "blank",
        "free_text",
    ]
    assert dumped["config"]["nodes"][0]["trigger"]["timeSeconds"] == 10

    stored = dump_script_config(result.config)
    assert "captionQuote" not in stored["nodes"][0]["display"]
    assert "highlights" not in stored["nodes"][0]["display"]
    assert stored["nodes"][0]["evaluation"] is None


def test_accepts_optional_notice_context_fields() -> None:
    payload = four_node_request()
    payload["config"]["nodes"][0]["display"].update(
        {"captionQuote": "remember this", "highlights": [{"text": "important"}]}
    )

    result = ScriptDraftRequest.model_validate(payload)

    assert result.config.nodes[0].display.caption_quote == "remember this"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda data: data["config"]["nodes"][0].update({"unknown": True}),
        lambda data: data["config"]["nodes"][1]["evaluation"].update({"answer": "missing"}),
        lambda data: data["config"]["nodes"][2]["evaluation"].update(
            {"acceptedAnswers": ["Suggested", " suggested "]}
        ),
        lambda data: data["config"]["nodes"][0]["display"].update({"title": "   "}),
    ],
)
def test_rejects_unknown_fields_invalid_answers_duplicates_and_blank_text(mutate) -> None:
    payload = four_node_request()
    mutate(payload)

    with pytest.raises(ValidationError):
        ScriptDraftRequest.model_validate(payload)


def test_rejects_duplicate_node_ids_and_out_of_order_nodes() -> None:
    duplicate = four_node_request()
    duplicate["config"]["nodes"][1]["id"] = "node-1"
    with pytest.raises(ValidationError):
        ScriptDraftRequest.model_validate(duplicate)

    out_of_order = copy.deepcopy(four_node_request())
    out_of_order["config"]["nodes"][1]["trigger"]["timeSeconds"] = 5
    with pytest.raises(ValidationError):
        ScriptDraftRequest.model_validate(out_of_order)
