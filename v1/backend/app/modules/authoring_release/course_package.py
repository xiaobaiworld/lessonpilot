"""Version 2 teacher course-package ZIP format.

This is deliberately separate from the student CoursePackage contract.  The
teacher package carries node assets, while a lesson's Bilibili video remains a
reference only.
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
import hashlib
import io
import json
import re
import stat
from typing import Any
import zipfile

from app.modules.authoring_release.asset_storage import AssetStorage, AssetStorageError
from app.modules.authoring_release.application_service import AuthoringReleaseError


COURSE_PACKAGE_SCHEMA_VERSION = 2
COURSE_PACKAGE_FILE_TYPE = "knownmap-course-package"
COURSE_PACKAGE_MAX_BYTES = 256 * 1024 * 1024
COURSE_PACKAGE_MAX_ASSETS = 200
COURSE_PACKAGE_MAX_MANIFEST_BYTES = 2 * 1024 * 1024
PORTABLE_ASSET_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$")
ASSET_METADATA_FIELDS = {
    "assetId",
    "kind",
    "mimeType",
    "byteSize",
    "sha256",
    "width",
    "height",
    "durationSeconds",
    "alt",
    "sourceType",
}
ASSET_FIELDS = ASSET_METADATA_FIELDS | {"path"}
ASSET_REFERENCE_FIELDS = {"assetId", "posterAssetId"}


class CoursePackageError(Exception):
    def __init__(self, code: str):
        self.code = code


@dataclass(frozen=True)
class ParsedCoursePackage:
    manifest: dict[str, Any]
    asset_bytes: dict[str, bytes]


def _invalid(code: str = "COURSE_PACKAGE_INVALID") -> None:
    raise CoursePackageError(code)


def _metadata(asset: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in asset.items() if key in ASSET_METADATA_FIELDS}


def _legacy_file(manifest: dict[str, Any]) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "fileType": "teacher-course",
        "source": manifest["source"],
        "course": manifest["course"],
    }


def validate_course_package_manifest(
    value: object, *, max_asset_bytes: int = 50 * 1024 * 1024
) -> dict[str, Any]:
    if not isinstance(value, dict):
        _invalid()
    if set(value) != {"schemaVersion", "fileType", "source", "course", "assets"}:
        _invalid()
    if value.get("schemaVersion") != COURSE_PACKAGE_SCHEMA_VERSION:
        _invalid("COURSE_PACKAGE_UNSUPPORTED")
    if value.get("fileType") != COURSE_PACKAGE_FILE_TYPE:
        _invalid()

    source = value.get("source")
    if not isinstance(source, dict) or set(source) != {
        "type",
        "courseId",
        "releaseId",
        "releaseNumber",
    }:
        _invalid()
    if (
        source.get("type") not in {"draft", "release"}
        or not isinstance(source.get("courseId"), str)
        or not source["courseId"].strip()
    ):
        _invalid()
    if source.get("releaseId") is not None and (
        not isinstance(source.get("releaseId"), str) or not source["releaseId"].strip()
    ):
        _invalid()
    if source.get("releaseNumber") is not None and (
        not isinstance(source.get("releaseNumber"), int) or source["releaseNumber"] < 1
    ):
        _invalid()
    if source["type"] == "draft" and (
        source.get("releaseId") is not None or source.get("releaseNumber") is not None
    ):
        _invalid()
    if source["type"] == "release" and (
        not source.get("releaseId") or source.get("releaseNumber") is None
    ):
        _invalid()

    course = value.get("course")
    assets = value.get("assets")
    if not isinstance(assets, list) or len(assets) > COURSE_PACKAGE_MAX_ASSETS:
        _invalid("COURSE_PACKAGE_TOO_LARGE")
    by_id: dict[str, dict[str, Any]] = {}
    for asset in assets:
        if not isinstance(asset, dict) or set(asset) - ASSET_FIELDS:
            _invalid()
        asset_id = asset.get("assetId")
        if not isinstance(asset_id, str) or not PORTABLE_ASSET_ID.fullmatch(asset_id):
            _invalid()
        if asset_id in by_id:
            _invalid()
        if asset.get("path") != f"assets/{asset_id}.bin":
            _invalid()
        if (
            not isinstance(asset.get("byteSize"), int)
            or isinstance(asset.get("byteSize"), bool)
            or asset["byteSize"] < 0
        ):
            _invalid()
        if asset["byteSize"] > max_asset_bytes:
            _invalid("COURSE_PACKAGE_TOO_LARGE")
        try:
            from app.modules.authoring_release.application_service import validate_config

            validate_config({"nodes": [], "assets": [_metadata(asset)]})
        except AuthoringReleaseError as error:
            raise CoursePackageError(error.code) from error
        by_id[asset_id] = asset

    try:
        from app.modules.authoring_release.portable import validate_teacher_course_file

        validate_teacher_course_file(_legacy_file(value))
    except AuthoringReleaseError as error:
        raise CoursePackageError(error.code) from error

    if not isinstance(course, dict):
        _invalid()
    referenced: set[str] = set()
    for lesson in course["lessons"]:
        for asset in lesson["assets"]:
            asset_id = asset["assetId"]
            if asset_id not in by_id or _metadata(by_id[asset_id]) != asset:
                _invalid("COURSE_PACKAGE_ASSET_METADATA_MISMATCH")
            referenced.add(asset_id)
    if referenced != set(by_id):
        _invalid("COURSE_PACKAGE_ASSET_METADATA_MISMATCH")
    return value


def parse_course_package(
    data: bytes,
    *,
    max_asset_bytes: int = 50 * 1024 * 1024,
    max_package_bytes: int = COURSE_PACKAGE_MAX_BYTES,
) -> ParsedCoursePackage:
    if len(data) > max_package_bytes:
        _invalid("COURSE_PACKAGE_TOO_LARGE")
    try:
        archive = zipfile.ZipFile(io.BytesIO(data))
    except (OSError, zipfile.BadZipFile):
        _invalid()

    with archive:
        infos = archive.infolist()
        if len(infos) > COURSE_PACKAGE_MAX_ASSETS + 1:
            _invalid("COURSE_PACKAGE_TOO_LARGE")
        if any(
            info.is_dir() or "\x00" in info.filename or stat.S_ISLNK(info.external_attr >> 16)
            for info in infos
        ):
            _invalid()
        names = [info.filename for info in infos]
        if len(names) != len(set(names)) or "manifest.json" not in names:
            _invalid()
        try:
            manifest_info = next(info for info in infos if info.filename == "manifest.json")
            if manifest_info.file_size > COURSE_PACKAGE_MAX_MANIFEST_BYTES:
                _invalid("COURSE_PACKAGE_TOO_LARGE")
            manifest = json.loads(archive.read(manifest_info).decode("utf-8"))
        except (
            StopIteration,
            UnicodeDecodeError,
            json.JSONDecodeError,
            KeyError,
            ValueError,
            zipfile.BadZipFile,
            NotImplementedError,
            RuntimeError,
        ):
            _invalid()
        validate_course_package_manifest(manifest, max_asset_bytes=max_asset_bytes)
        expected_paths = {asset["path"] for asset in manifest["assets"]}
        actual_paths = set(names) - {"manifest.json"}
        if actual_paths != expected_paths:
            _invalid()
        if sum(info.file_size for info in infos) > max_package_bytes:
            _invalid("COURSE_PACKAGE_TOO_LARGE")
        result: dict[str, bytes] = {}
        try:
            for asset in manifest["assets"]:
                content = archive.read(asset["path"])
                if len(content) != asset["byteSize"]:
                    _invalid("COURSE_PACKAGE_ASSET_INTEGRITY_FAILED")
                if hashlib.sha256(content).hexdigest().lower() != asset["sha256"].lower():
                    _invalid("COURSE_PACKAGE_ASSET_INTEGRITY_FAILED")
                result[asset["assetId"]] = content
        except (KeyError, zipfile.BadZipFile, NotImplementedError, RuntimeError, EOFError):
            _invalid("COURSE_PACKAGE_ASSET_INTEGRITY_FAILED")
        return ParsedCoursePackage(manifest=manifest, asset_bytes=result)


def build_course_package(
    teacher_file: dict[str, Any], teacher_id: str, store: AssetStorage
) -> bytes:
    manifest = {
        "schemaVersion": COURSE_PACKAGE_SCHEMA_VERSION,
        "fileType": COURSE_PACKAGE_FILE_TYPE,
        "source": deepcopy(teacher_file["source"]),
        "course": deepcopy(teacher_file["course"]),
        "assets": [],
    }
    by_id: dict[str, dict[str, Any]] = {}
    for lesson in manifest["course"]["lessons"]:
        for asset in lesson["assets"]:
            asset_id = asset["assetId"]
            prior = by_id.get(asset_id)
            if prior is not None and prior != asset:
                raise CoursePackageError("COURSE_PACKAGE_ASSET_METADATA_MISMATCH")
            if prior is None:
                portable = deepcopy(asset)
                portable["path"] = f"assets/{asset_id}.bin"
                by_id[asset_id] = portable
    manifest["assets"] = list(by_id.values())
    try:
        validate_course_package_manifest(manifest, max_asset_bytes=store.max_bytes)
    except CoursePackageError:
        raise
    binaries: dict[str, bytes] = {}
    for asset in manifest["assets"]:
        try:
            record, path = store.get(teacher_id, asset["assetId"])
        except AssetStorageError as error:
            raise CoursePackageError("COURSE_PACKAGE_ASSET_NOT_FOUND") from error
        if record != _metadata(asset):
            raise CoursePackageError("COURSE_PACKAGE_ASSET_METADATA_MISMATCH")
        try:
            content = path.read_bytes()
        except OSError as error:
            raise CoursePackageError("COURSE_PACKAGE_ASSET_NOT_FOUND") from error
        if hashlib.sha256(content).hexdigest().lower() != asset["sha256"].lower():
            raise CoursePackageError("COURSE_PACKAGE_ASSET_INTEGRITY_FAILED")
        binaries[asset["assetId"]] = content

    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(
            "manifest.json",
            json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode(
                "utf-8"
            ),
        )
        for asset in manifest["assets"]:
            archive.writestr(asset["path"], binaries[asset["assetId"]])
    result = output.getvalue()
    if len(result) > COURSE_PACKAGE_MAX_BYTES:
        raise CoursePackageError("COURSE_PACKAGE_TOO_LARGE")
    return result


def summary(parsed: ParsedCoursePackage) -> dict[str, Any]:
    course = parsed.manifest["course"]
    return {
        "package_schema_version": parsed.manifest["schemaVersion"],
        "title": course["title"],
        "lesson_count": len(course["lessons"]),
        "node_count": sum(len(lesson["nodes"]) for lesson in course["lessons"]),
        "asset_count": len(parsed.manifest["assets"]),
        "asset_bytes": sum(asset["byteSize"] for asset in parsed.manifest["assets"]),
        "source_type": parsed.manifest["source"]["type"],
        "source_release_number": parsed.manifest["source"]["releaseNumber"],
        "has_subtitles": any(lesson["subtitle"] is not None for lesson in course["lessons"]),
    }


def rewrite_asset_refs(value: object, mapping: dict[str, str]) -> object:
    if isinstance(value, list):
        return [rewrite_asset_refs(item, mapping) for item in value]
    if isinstance(value, dict):
        return {
            key: mapping.get(item, item)
            if key in ASSET_REFERENCE_FIELDS and isinstance(item, str)
            else rewrite_asset_refs(item, mapping)
            for key, item in value.items()
        }
    return value
