"""Voice services used by Leticia assistant."""

from anm_backend.services.voice.azure_speech_service import (
    AzureSpeechConfigurationError,
    AzureSpeechService,
    AzureSpeechSynthesisError,
    VoiceOption,
)

__all__ = [
    "AzureSpeechConfigurationError",
    "AzureSpeechService",
    "AzureSpeechSynthesisError",
    "VoiceOption",
]

