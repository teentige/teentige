"""Configuration management for the Discord AI Bot."""

import os
from dataclasses import dataclass
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file if present
load_dotenv()


@dataclass
class Config:
    """Application configuration loaded from environment variables."""

    discord_token: str = os.getenv("DISCORD_TOKEN", "")
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")
    openai_base_url: Optional[str] = os.getenv("OPENAI_BASE_URL") or None
    openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    command_prefix: str = os.getenv("COMMAND_PREFIX", "!")
    max_history: int = int(os.getenv("MAX_HISTORY", "10"))
    max_tokens: int = int(os.getenv("MAX_TOKENS", "1000"))
    temperature: float = float(os.getenv("TEMPERATURE", "0.7"))
    memory_timeout_minutes: int = int(os.getenv("MEMORY_TIMEOUT_MINUTES", "30"))
    default_persona: str = os.getenv("DEFAULT_PERSONA", "assistant")
    mock_mode: bool = os.getenv("MOCK_MODE", "").lower() in ("true", "1", "yes")

    @property
    def is_ai_configured(self) -> bool:
        """Return True if an OpenAI API key is provided and mock mode is not forced."""
        return bool(self.openai_api_key and not self.mock_mode)

    def print_summary(self) -> str:
        """Return a safe summary of the configuration for logging."""
        token_status = "SET (masked)" if self.discord_token else "NOT SET (required to connect)"
        ai_status = (
            f"Active (model: {self.openai_model})"
            if self.is_ai_configured
            else "Offline / Simulation Mode (Set OPENAI_API_KEY for live AI)"
        )
        return (
            f"Bot Configuration:\n"
            f"  • Discord Token: {token_status}\n"
            f"  • Command Prefix: '{self.command_prefix}'\n"
            f"  • AI Provider: {ai_status}\n"
            f"  • Base URL: {self.openai_base_url or 'Default OpenAI API'}\n"
            f"  • Default Persona: {self.default_persona}\n"
            f"  • Max Memory Turns: {self.max_history}\n"
            f"  • Max Output Tokens: {self.max_tokens}\n"
            f"  • Temperature: {self.temperature}"
        )


# Global configuration instance
config = Config()
