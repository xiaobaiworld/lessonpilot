import base64
import hashlib
import hmac
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.entitlement_delivery.models import AccessCode, GrantItem, Redemption


class EntitlementError(Exception):
    def __init__(self, code: str):
        self.code = code


def _aware(value: datetime | None) -> datetime | None:
    return value.replace(tzinfo=timezone.utc) if value and value.tzinfo is None else value


class EntitlementApplicationService:
    def __init__(self, session: Session, secret: str):
        self.session = session
        self.secret = secret.encode()

    def _hmac(self, value: str) -> str:
        return hmac.new(self.secret, value.encode(), hashlib.sha256).hexdigest()

    def _raw_code(self, teacher_id: str, intent: str) -> str:
        digest = hmac.new(self.secret, f"{teacher_id}\0{intent}".encode(), hashlib.sha256).digest()
        text = base64.b32encode(digest).decode().rstrip("=")[:20]
        return "KM-" + "-".join(text[index : index + 5] for index in range(0, 20, 5))

    def create_code(
        self,
        teacher_id: str,
        intent: str,
        grants: list[dict],
        redeem_from: datetime | None,
        redeem_until: datetime | None,
        recipient_label: str | None = None,
        recipient_note: str | None = None,
        commit: bool = True,
    ) -> tuple[AccessCode, str, bool]:
        existing = self.session.scalar(
            select(AccessCode).where(
                AccessCode.created_by_teacher_id == teacher_id,
                AccessCode.idempotency_key == intent,
            )
        )
        raw = self._raw_code(teacher_id, intent)
        if existing:
            return existing, raw, True
        if redeem_from and redeem_until and redeem_from >= redeem_until:
            raise EntitlementError("ACCESS_CODE_WINDOW_INVALID")
        code = AccessCode(
            id=str(uuid4()),
            code_digest=self._hmac(raw),
            display_tail=raw[-5:],
            created_by_teacher_id=teacher_id,
            idempotency_key=intent,
            redeem_from=redeem_from,
            redeem_until=redeem_until,
            recipient_label=recipient_label,
            recipient_note=recipient_note,
        )
        code.grants = [
            GrantItem(
                id=str(uuid4()),
                course_id=item["course_id"],
                scope=item["scope"],
                scope_data=item["scope_data"],
                valid_from=item.get("valid_from"),
                valid_until=item.get("valid_until"),
            )
            for item in grants
        ]
        self.session.add(code)
        if commit:
            self.session.commit()
        return code, raw, False

    def create_code_batch(
        self,
        teacher_id: str,
        batch_intent: str,
        count: int,
        grants: list[dict],
        redeem_from: datetime | None,
        redeem_until: datetime | None,
        recipient_label: str | None = None,
        recipient_note: str | None = None,
        commit: bool = True,
    ) -> tuple[list[tuple[AccessCode, str]], bool]:
        created: list[tuple[AccessCode, str]] = []
        replayed_flags: list[bool] = []
        try:
            for index in range(count):
                digest = hashlib.sha256(f"{batch_intent}\0{index}".encode()).hexdigest()
                intent = f"batch-{digest[:58]}"
                code, raw, replayed = self.create_code(
                    teacher_id,
                    intent,
                    grants,
                    redeem_from,
                    redeem_until,
                    recipient_label,
                    recipient_note,
                    commit=False,
                )
                created.append((code, raw))
                replayed_flags.append(replayed)
            if commit:
                self.session.commit()
            return created, all(replayed_flags)
        except Exception:
            self.session.rollback()
            raise

    def reveal_code(self, code: AccessCode) -> str:
        raw = self._raw_code(code.created_by_teacher_id, code.idempotency_key)
        if not hmac.compare_digest(code.code_digest, self._hmac(raw)):
            raise EntitlementError("ACCESS_CODE_RECOVERY_FAILED")
        return raw

    def list_codes(self, teacher_id: str, course_id: str | None = None) -> list[AccessCode]:
        statement = (
            select(AccessCode)
            .options(selectinload(AccessCode.grants), selectinload(AccessCode.redemptions))
            .where(AccessCode.created_by_teacher_id == teacher_id)
            .order_by(AccessCode.created_at.desc())
        )
        if course_id:
            statement = statement.join(GrantItem).where(GrantItem.course_id == course_id)
        return list(self.session.scalars(statement).unique())

    def course_dashboard_metrics(
        self, teacher_id: str, course_ids: list[str]
    ) -> dict[str, dict[str, int]]:
        """Aggregate delivery counts without exposing codes, identities, or proofs."""
        metrics = {
            course_id: {"access_code_count": 0, "redeemed_count": 0} for course_id in course_ids
        }
        if not course_ids:
            return metrics
        seen_codes: dict[str, set[str]] = {course_id: set() for course_id in course_ids}
        seen_redemptions: dict[str, set[str]] = {course_id: set() for course_id in course_ids}
        for code in self.list_codes(teacher_id):
            code_courses: set[str] = set()
            for grant in code.grants:
                if grant.course_id not in metrics:
                    continue
                seen_codes[grant.course_id].add(code.id)
                code_courses.add(grant.course_id)
            for course_id in code_courses:
                seen_redemptions[course_id].update(
                    redemption.local_identity_digest for redemption in code.redemptions
                )
        for course_id, code_ids in seen_codes.items():
            metrics[course_id]["access_code_count"] = len(code_ids)
            metrics[course_id]["redeemed_count"] = len(seen_redemptions[course_id])
        return metrics

    def get_code(self, teacher_id: str, code_id: str) -> AccessCode:
        code = self.session.scalar(
            select(AccessCode)
            .options(selectinload(AccessCode.grants), selectinload(AccessCode.redemptions))
            .where(AccessCode.id == code_id, AccessCode.created_by_teacher_id == teacher_id)
        )
        if not code:
            raise EntitlementError("ACCESS_CODE_NOT_FOUND")
        return code

    def set_recipient(
        self,
        teacher_id: str,
        code_id: str,
        recipient_label: str | None,
        recipient_note: str | None,
        commit: bool = True,
    ) -> AccessCode:
        code = self.get_code(teacher_id, code_id)
        code.recipient_label = recipient_label
        code.recipient_note = recipient_note
        if commit:
            self.session.commit()
        return code

    def set_status(
        self, teacher_id: str, code_id: str, action: str, commit: bool = True
    ) -> tuple[AccessCode, bool]:
        code = self.get_code(teacher_id, code_id)
        changed = self._apply_status(code, action)
        if commit:
            self.session.commit()
        return code, changed

    def batch_set_status(
        self,
        teacher_id: str,
        code_ids: list[str],
        action: str,
        commit: bool = True,
    ) -> tuple[list[AccessCode], bool]:
        if len(code_ids) != len(set(code_ids)):
            raise EntitlementError("ACCESS_CODE_BATCH_DUPLICATE")
        codes = [self.get_code(teacher_id, code_id) for code_id in code_ids]
        changed = False
        try:
            for code in codes:
                changed = self._apply_status(code, action) or changed
            if commit:
                self.session.commit()
        except Exception:
            self.session.rollback()
            raise
        return codes, not changed

    @staticmethod
    def _apply_status(code: AccessCode, action: str) -> bool:
        transitions = {
            "freeze": {"active": "frozen", "frozen": "frozen"},
            "restore": {"active": "active", "frozen": "active"},
            "terminate": {
                "active": "terminated",
                "frozen": "terminated",
                "terminated": "terminated",
            },
        }
        next_status = transitions.get(action, {}).get(code.status)
        if next_status is None:
            raise EntitlementError("ACCESS_CODE_STATE_INVALID")
        if next_status == code.status:
            return False
        code.status = next_status
        if next_status == "terminated":
            code.terminated_at = datetime.now(timezone.utc)
        else:
            code.terminated_at = None
        return True

    def terminate(self, teacher_id: str, code_id: str) -> AccessCode:
        code, _ = self.set_status(teacher_id, code_id, "terminate")
        return code

    def redeem(self, raw_code: str, local_identity: str, local_proof: str) -> Redemption:
        code = self.session.scalar(
            select(AccessCode)
            .options(selectinload(AccessCode.grants))
            .where(AccessCode.code_digest == self._hmac(raw_code.strip().upper()))
        )
        now = datetime.now(timezone.utc)
        if (
            not code
            or code.status != "active"
            or (_aware(code.redeem_from) and now < _aware(code.redeem_from))
            or (_aware(code.redeem_until) and now >= _aware(code.redeem_until))
        ):
            raise EntitlementError("GRANT_CODE_INVALID")
        identity_digest = self._hmac(f"identity\0{local_identity}")
        proof_digest = self._hmac(f"proof\0{local_identity}\0{local_proof}")
        redemption = self.session.scalar(
            select(Redemption).where(
                Redemption.access_code_id == code.id,
                Redemption.local_identity_digest == identity_digest,
            )
        )
        if redemption and not hmac.compare_digest(redemption.local_proof_digest, proof_digest):
            raise EntitlementError("LOCAL_PROOF_INVALID")
        if redemption:
            redemption.last_redeemed_at = now
        else:
            redemption = Redemption(
                id=str(uuid4()),
                access_code_id=code.id,
                local_identity_digest=identity_digest,
                local_proof_digest=proof_digest,
                scope_summary=[self._grant_data(item) for item in code.grants],
            )
            self.session.add(redemption)
        self.session.commit()
        return redemption

    def effective_grants(self, local_identity: str, local_proof: str) -> dict[str, dict]:
        identity_digest = self._hmac(f"identity\0{local_identity}")
        proof_digest = self._hmac(f"proof\0{local_identity}\0{local_proof}")
        redemptions = list(
            self.session.scalars(
                select(Redemption)
                .options(selectinload(Redemption.access_code).selectinload(AccessCode.grants))
                .where(Redemption.local_identity_digest == identity_digest)
            )
        )
        if redemptions and any(
            not hmac.compare_digest(item.local_proof_digest, proof_digest) for item in redemptions
        ):
            raise EntitlementError("LOCAL_PROOF_INVALID")
        now = datetime.now(timezone.utc)
        result: dict[str, dict] = {}
        for redemption in redemptions:
            code = redemption.access_code
            if code.status != "active" or (
                _aware(code.redeem_until) and now >= _aware(code.redeem_until)
            ):
                continue
            for grant in code.grants:
                if (_aware(grant.valid_from) and now < _aware(grant.valid_from)) or (
                    _aware(grant.valid_until) and now >= _aware(grant.valid_until)
                ):
                    continue
                current = result.setdefault(
                    grant.course_id, {"type": "partial", "lessonIds": set(), "nodeIds": set()}
                )
                if grant.scope == "course":
                    current["type"] = "course"
                current["lessonIds"].update(grant.scope_data.get("lessonIds", []))
                current["nodeIds"].update(grant.scope_data.get("nodeIds", []))
        return result

    @staticmethod
    def _grant_data(grant: GrantItem) -> dict:
        return {
            "courseId": grant.course_id,
            "type": grant.scope,
            "lessonIds": grant.scope_data.get("lessonIds", []),
            "nodeIds": grant.scope_data.get("nodeIds", []),
        }

    @staticmethod
    def crop_package(package: dict, scope: dict) -> dict:
        if scope["type"] == "course":
            return package
        lesson_ids = scope["lessonIds"]
        node_ids = scope["nodeIds"]
        cropped = {**package}
        cropped["lessons"] = []
        for lesson in package["lessons"]:
            if lesson["lessonId"] not in lesson_ids and not node_ids:
                continue
            selected = {**lesson}
            if node_ids:
                selected["nodes"] = [node for node in lesson["nodes"] if node["id"] in node_ids]
            if selected["nodes"]:
                cropped["lessons"].append(selected)
        referenced: set[str] = set()
        for lesson in cropped["lessons"]:
            for node in lesson["nodes"]:
                for block in node.get("content", {}).get("blocks", []):
                    if isinstance(block, dict) and isinstance(block.get("assetId"), str):
                        referenced.add(block["assetId"])
                    if isinstance(block, dict) and isinstance(block.get("posterAssetId"), str):
                        referenced.add(block["posterAssetId"])
        cropped["assets"] = [
            asset for asset in package.get("assets", []) if asset.get("assetId") in referenced
        ]
        return cropped
