from tests.test_authoring_release_api import NODE, make_client


def create_draft():
    client = make_client()
    course = client.post("/api/v1/teacher/courses", json={"title": "课程"}).json()
    lesson = client.post(
        f"/api/v1/teacher/courses/{course['id']}/lessons",
        json={
            "title": "第一课",
            "video_ref": {"platform": "bilibili", "video_id": "BV1Ac41187Lm"},
        },
    ).json()
    saved = client.put(
        f"/api/v1/teacher/lessons/{lesson['id']}/draft",
        json={"schema_version": 1, "config": {"nodes": [NODE]}},
    )
    assert saved.status_code == 200
    return client, lesson["id"], saved.json()["revision"]


def presentation_payload(revision: int) -> dict:
    return {
        "revision": revision,
        "presentationHints": {
            "windowSize": {"widthPercent": 42.5, "heightPercent": 31.2},
            "windowPosition": {"xPercent": 63.4, "yPercent": 28.7},
            "windowStyle": "document",
        },
    }


def test_update_node_presentation_updates_one_node_and_revision():
    client, lesson_id, revision = create_draft()

    response = client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft/nodes/node-1/presentation",
        json=presentation_payload(revision),
    )

    assert response.status_code == 200
    assert response.json() == {
        "lessonId": lesson_id,
        "nodeId": "node-1",
        "revision": 2,
        "presentationHints": presentation_payload(revision)["presentationHints"],
    }
    draft = client.get(f"/api/v1/teacher/lessons/{lesson_id}/draft").json()
    assert draft["revision"] == 2
    assert draft["config"]["nodes"][0]["presentationHints"] == response.json()["presentationHints"]


def test_update_node_presentation_rejects_invalid_range_without_writing():
    client, lesson_id, revision = create_draft()
    payload = presentation_payload(revision)
    payload["presentationHints"]["windowSize"]["widthPercent"] = 66.1

    response = client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft/nodes/node-1/presentation",
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "DRAFT_NODE_PRESENTATION_INVALID"
    draft = client.get(f"/api/v1/teacher/lessons/{lesson_id}/draft").json()
    assert draft["revision"] == revision
    assert draft["config"]["nodes"][0]["presentationHints"] == NODE["presentationHints"]


def test_update_node_presentation_rejects_revision_conflict_and_missing_node():
    client, lesson_id, revision = create_draft()

    conflict = client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft/nodes/node-1/presentation",
        json=presentation_payload(revision - 1),
    )
    assert conflict.status_code == 409
    assert conflict.json()["error"]["code"] == "REVISION_CONFLICT"

    missing = client.put(
        f"/api/v1/teacher/lessons/{lesson_id}/draft/nodes/missing/presentation",
        json=presentation_payload(revision),
    )
    assert missing.status_code == 404
