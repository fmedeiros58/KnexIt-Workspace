"""
FILE: services/voice/azure_speech_service.py
RESPONSIBILITY: Azure Speech SDK voice listing and text-to-speech synthesis for Leticia.
FLOW ROLE: Resolve voice profile by locale/id and return MP3 audio bytes.
READS: Environment variables for Azure Speech credentials and voice defaults.
RAM WRITES: None (stateless per request).
PERSISTS: None.
PRIMARY RISK: Missing Azure credentials or package can break voice emission.
"""

from __future__ import annotations

import html
import os
from dataclasses import dataclass
from typing import Dict, List, Tuple

try:
    import azure.cognitiveservices.speech as speechsdk
except Exception:  # noqa: BLE001
    speechsdk = None


@dataclass(frozen=True)
class VoiceOption:
    id: str
    name: str
    lang: str
    source: str = "azure"


class AzureSpeechConfigurationError(RuntimeError):
    """Raised when Azure Speech SDK cannot be configured."""


class AzureSpeechSynthesisError(RuntimeError):
    """Raised when Azure Speech synthesis fails."""


DEFAULT_VOICE_OPTIONS: List[VoiceOption] = [
    VoiceOption(id="pt-BR-BrendaNeural", name="Brenda Neural", lang="pt-BR"),
]


def _pick_first_non_empty(*values: str) -> str:
    for value in values:
        normalized = str(value or "").strip()
        if normalized:
            return normalized
    return ""


def _normalize_locale_tag(value: str) -> str:
    normalized = str(value or "").strip().replace("_", "-").lower()
    if normalized.startswith("pt"):
        return "pt-BR"
    if normalized.startswith("en"):
        return "en-US"
    if normalized.startswith("es"):
        return "es-ES"
    return "pt-BR"


def _voice_locale_from_id(voice_id: str) -> str:
    tokens = str(voice_id or "").split("-")
    if len(tokens) >= 2:
        return _normalize_locale_tag(f"{tokens[0]}-{tokens[1]}")
    return "pt-BR"


def _build_voice_name(voice_id: str) -> str:
    raw = str(voice_id or "").strip()
    if not raw:
        return "Voice"
    name = raw.split("-")[-1]
    name = name.replace("Neural", " Neural")
    return " ".join(name.split()).strip() or raw


def _parse_voice_list(raw: str) -> List[VoiceOption]:
    items: List[VoiceOption] = []
    seen: set[str] = set()
    for token in str(raw or "").split(","):
        voice_id = token.strip()
        if not voice_id or voice_id in seen:
            continue
        seen.add(voice_id)
        items.append(
            VoiceOption(
                id=voice_id,
                name=_build_voice_name(voice_id),
                lang=_voice_locale_from_id(voice_id),
            )
        )
    return items


def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def _rate_to_percent(value: float) -> str:
    # 1.0 = 0%, 0.75 = -25%, 1.35 = +35%
    delta = int(round((_clamp(value, 0.75, 1.35) - 1.0) * 100))
    return f"{delta:+d}%"


def _pitch_to_percent(value: float) -> str:
    # Keep pitch shifts softer than rate shifts for readability.
    delta = int(round((_clamp(value, 0.7, 1.35) - 1.0) * 60))
    return f"{delta:+d}%"


class AzureSpeechService:
    def __init__(
        self,
        *,
        subscription_key: str,
        region: str,
        voices: List[VoiceOption],
        default_voice_by_locale: Dict[str, str],
    ) -> None:
        self.subscription_key = subscription_key
        self.region = region
        self.voices = voices
        self.default_voice_by_locale = default_voice_by_locale
        self._voice_index = {voice.id: voice for voice in voices}

    @classmethod
    def from_env(cls) -> "AzureSpeechService":
        subscription_key = _pick_first_non_empty(
            os.getenv("AZURE_SPEECH_KEY", ""),
            os.getenv("ANM_AZURE_SPEECH_KEY", ""),
        )
        region = _pick_first_non_empty(
            os.getenv("AZURE_SPEECH_REGION", ""),
            os.getenv("ANM_AZURE_SPEECH_REGION", ""),
        )
        configured_voices = _parse_voice_list(os.getenv("ANM_AZURE_TTS_VOICES", ""))
        voices = configured_voices or DEFAULT_VOICE_OPTIONS

        default_voice_by_locale = {
            "pt-BR": _pick_first_non_empty(
                os.getenv("ANM_AZURE_TTS_VOICE_PT_BR", ""),
                "pt-BR-BrendaNeural",
            ),
            "en-US": _pick_first_non_empty(
                os.getenv("ANM_AZURE_TTS_VOICE_EN_US", ""),
                "pt-BR-BrendaNeural",
            ),
            "es-ES": _pick_first_non_empty(
                os.getenv("ANM_AZURE_TTS_VOICE_ES_ES", ""),
                "pt-BR-BrendaNeural",
            ),
        }
        return cls(
            subscription_key=subscription_key,
            region=region,
            voices=voices,
            default_voice_by_locale=default_voice_by_locale,
        )

    @property
    def sdk_available(self) -> bool:
        return speechsdk is not None

    @property
    def configured(self) -> bool:
        return bool(self.subscription_key and self.region)

    def resolve_voice_id(self, *, locale_hint: str, voice_id: str) -> str:
        selected = str(voice_id or "").strip()
        if selected and selected in self._voice_index:
            return selected
        locale = _normalize_locale_tag(locale_hint)
        default_id = self.default_voice_by_locale.get(locale, "")
        if default_id and default_id in self._voice_index:
            return default_id
        for option in self.voices:
            if _normalize_locale_tag(option.lang) == locale:
                return option.id
        return self.voices[0].id if self.voices else default_id

    def _build_ssml(self, *, text: str, locale: str, voice_id: str, rate: float, pitch: float) -> str:
        escaped_text = html.escape(text.strip())
        lang = _normalize_locale_tag(locale or _voice_locale_from_id(voice_id))
        return (
            "<speak version='1.0' xml:lang='{lang}'>"
            "<voice name='{voice}'>"
            "<prosody rate='{rate}' pitch='{pitch}'>{text}</prosody>"
            "</voice>"
            "</speak>"
        ).format(
            lang=lang,
            voice=html.escape(voice_id),
            rate=_rate_to_percent(rate),
            pitch=_pitch_to_percent(pitch),
            text=escaped_text,
        )

    def _ensure_ready(self) -> None:
        if speechsdk is None:
            raise AzureSpeechConfigurationError("azure_speech_sdk_not_installed")
        if not self.subscription_key or not self.region:
            raise AzureSpeechConfigurationError("azure_speech_credentials_missing")

    def synthesize(
        self,
        *,
        text: str,
        locale_hint: str = "",
        voice_id: str = "",
        rate: float = 1.0,
        pitch: float = 1.0,
    ) -> Tuple[bytes, Dict[str, str]]:
        message = str(text or "").strip()
        if not message:
            raise AzureSpeechSynthesisError("text_required")
        self._ensure_ready()

        resolved_voice_id = self.resolve_voice_id(locale_hint=locale_hint, voice_id=voice_id)
        resolved_locale = _normalize_locale_tag(locale_hint or _voice_locale_from_id(resolved_voice_id))
        ssml = self._build_ssml(
            text=message,
            locale=resolved_locale,
            voice_id=resolved_voice_id,
            rate=rate,
            pitch=pitch,
        )

        speech_config = speechsdk.SpeechConfig(subscription=self.subscription_key, region=self.region)  # type: ignore[union-attr]
        speech_config.set_speech_synthesis_output_format(  # type: ignore[union-attr]
            speechsdk.SpeechSynthesisOutputFormat.Audio24Khz48KBitRateMonoMp3  # type: ignore[union-attr]
        )
        synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)  # type: ignore[union-attr]
        result = synthesizer.speak_ssml_async(ssml).get()

        if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:  # type: ignore[union-attr]
            payload = bytes(result.audio_data or b"")
            if not payload:
                raise AzureSpeechSynthesisError("azure_speech_empty_audio")
            metadata = {
                "voice_id": resolved_voice_id,
                "locale": resolved_locale,
                "provider": "azure",
            }
            return payload, metadata

        if result.reason == speechsdk.ResultReason.Canceled:  # type: ignore[union-attr]
            details = speechsdk.SpeechSynthesisCancellationDetails(result)  # type: ignore[union-attr]
            reason = str(getattr(details, "reason", "canceled"))
            error_details = str(getattr(details, "error_details", "") or "").strip()
            code = str(getattr(details, "error_code", "") or "").strip()
            raise AzureSpeechSynthesisError(
                f"azure_speech_canceled:{reason}:{code}:{error_details}".strip(":")
            )

        raise AzureSpeechSynthesisError(f"azure_speech_failed:{result.reason}")
