import pytest

from app.modules.authoring_release.application_service import (
    AuthoringReleaseError,
    validate_config,
)


def node(kind="notice", **overrides):
    value = {
        "id": "node-1",
        "enabled": True,
        "family": "attention" if kind == "notice" else "practice",
        "interaction": kind,
        "anchor": {"kind": "time_cross", "timeSeconds": 12},
        "title": "重点" if kind == "notice" else "题目",
        "content": {
            "schemaVersion": 1,
            "blocks": [{"type": "paragraph", "children": [{"text": "结构化正文"}]}],
        },
        "interactionData": None
        if kind == "notice"
        else {
            "options": [{"id": "a", "label": "甲"}, {"id": "b", "label": "乙"}],
            "answer": "a",
            "explanation": "解析",
        },
        "presentationHints": {"windowSize": "overlay", "windowStyle": "document"},
        "effects": {"pause": True},
    }
    value.update(overrides)
    return value


def test_structured_notice_and_question_are_valid():
    nodes, assets = validate_config({"nodes": [node()], "assets": []})
    assert nodes[0]["content"]["schemaVersion"] == 1
    assert assets == []


def test_old_display_body_and_evaluation_are_rejected():
    with pytest.raises(AuthoringReleaseError) as error:
        validate_config({"nodes": [node(display={"title": "旧", "body": "旧正文"})], "assets": []})
    assert error.value.code == "DRAFT_LEGACY_NODE_UNSUPPORTED"


def test_unknown_document_version_and_block_are_explicit_failures():
    with pytest.raises(AuthoringReleaseError) as version:
        validate_config({"nodes": [node(content={"schemaVersion": 2, "blocks": []})], "assets": []})
    assert version.value.code == "DRAFT_DOCUMENT_VERSION_UNSUPPORTED"
    with pytest.raises(AuthoringReleaseError) as block:
        validate_config(
            {
                "nodes": [node(content={"schemaVersion": 1, "blocks": [{"type": "canvas"}]})],
                "assets": [],
            }
        )
    assert block.value.code == "DRAFT_CONTENT_BLOCK_UNSUPPORTED"


def test_asset_reference_requires_manifest_and_can_be_reused():
    asset = {
        "assetId": "asset-1",
        "kind": "image",
        "mimeType": "image/png",
        "byteSize": 4,
        "sha256": "a" * 64,
        "sourceType": "uploaded",
    }
    with pytest.raises(AuthoringReleaseError) as missing:
        validate_config(
            {
                "nodes": [
                    node(
                        content={
                            "schemaVersion": 1,
                            "blocks": [{"type": "image", "assetId": "asset-1", "alt": "图"}],
                        }
                    )
                ],
                "assets": [],
            }
        )
    assert missing.value.code == "DRAFT_ASSET_REFERENCE_MISSING"
    nodes, assets = validate_config(
        {
            "nodes": [
                node(
                    content={
                        "schemaVersion": 1,
                        "blocks": [{"type": "image", "assetId": "asset-1", "alt": "图"}],
                    }
                ),
                node(
                    "notice",
                    id="node-2",
                    content={
                        "schemaVersion": 1,
                        "blocks": [{"type": "image", "assetId": "asset-1", "alt": "同一张图"}],
                    },
                ),
            ],
            "assets": [asset],
        }
    )
    assert len(nodes) == 2
    assert len(assets) == 1


def test_closed_node_and_inline_shapes_are_enforced():
    with pytest.raises(AuthoringReleaseError) as extra:
        validate_config({"nodes": [node(unexpected="value")], "assets": []})
    assert extra.value.code == "DRAFT_NODE_CONTENT_INVALID"

    with pytest.raises(AuthoringReleaseError) as unsafe_link:
        validate_config(
            {
                "nodes": [
                    node(
                        content={
                            "schemaVersion": 1,
                            "blocks": [
                                {
                                    "type": "paragraph",
                                    "children": [
                                        {"text": "链接", "link": {"href": "javascript:alert(1)"}}
                                    ],
                                }
                            ],
                        }
                    )
                ],
                "assets": [],
            }
        )
    assert unsafe_link.value.code == "DRAFT_NODE_CONTENT_INVALID"


def test_media_reference_must_match_asset_kind_and_poster_must_be_an_image():
    video = {
        "assetId": "video-1",
        "kind": "video",
        "mimeType": "video/mp4",
        "byteSize": 4,
        "sha256": "b" * 64,
        "sourceType": "uploaded",
    }
    image = {
        "assetId": "image-1",
        "kind": "image",
        "mimeType": "image/png",
        "byteSize": 4,
        "sha256": "c" * 64,
        "sourceType": "uploaded",
    }
    with pytest.raises(AuthoringReleaseError) as mismatch:
        validate_config(
            {
                "nodes": [
                    node(
                        content={
                            "schemaVersion": 1,
                            "blocks": [{"type": "image", "assetId": "video-1", "alt": "图"}],
                        }
                    )
                ],
                "assets": [video],
            }
        )
    assert mismatch.value.code == "DRAFT_ASSET_REFERENCE_INVALID"

    nodes, assets = validate_config(
        {
            "nodes": [
                node(
                    content={
                        "schemaVersion": 1,
                        "blocks": [
                            {
                                "type": "video",
                                "assetId": "video-1",
                                "posterAssetId": "image-1",
                                "title": "片段",
                            }
                        ],
                    }
                )
            ],
            "assets": [video, image],
        }
    )
    assert len(nodes) == 1
    assert {asset["assetId"] for asset in assets} == {"video-1", "image-1"}
