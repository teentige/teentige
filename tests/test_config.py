"""Unit tests for configuration manager."""

import os
from bot.config import Config


def test_config_defaults():
    cfg = Config()
    assert cfg.command_prefix == "!"
    assert cfg.max_history == 10
    assert cfg.max_tokens == 1000
    assert cfg.default_persona == "assistant"


def test_config_ai_configured_logic():
    cfg_unconfigured = Config(openai_api_key="")
    assert cfg_unconfigured.is_ai_configured is False

    cfg_mock = Config(openai_api_key="sk-test", mock_mode=True)
    assert cfg_mock.is_ai_configured is False

    cfg_active = Config(openai_api_key="sk-valid-key", mock_mode=False)
    assert cfg_active.is_ai_configured is True


def test_config_summary_masking():
    cfg = Config(discord_token="secret_token_12345", openai_api_key="sk-secret")
    summary = cfg.print_summary()
    assert "secret_token_12345" not in summary
    assert "sk-secret" not in summary
    assert "SET (masked)" in summary
