"""Unit tests for AI Service and Persona handling."""

import pytest
from bot.ai_service import AIService
from bot.personas import PERSONAS, get_persona_prompt, list_personas


def test_personas_registry():
    personas = list_personas()
    assert len(personas) >= 5

    keys = [p["id"] for p in personas]
    assert "assistant" in keys
    assert "coder" in keys
    assert "teacher" in keys
    assert "pirate" in keys
    assert "sarcastic" in keys

    # Prompt retrieval
    coder_prompt = get_persona_prompt("coder")
    assert "software engineer" in coder_prompt

    # Default fallback for invalid key
    unknown_prompt = get_persona_prompt("nonexistent_persona")
    assert unknown_prompt == PERSONAS["assistant"]["prompt"]


@pytest.mark.asyncio
async def test_ai_simulation_mode_greetings():
    service = AIService()
    # Force mock mode for test
    service.client = None

    response = await service.generate_response("Hello there!", persona="assistant")
    assert "Hello" in response or "Simulation Mode" in response


@pytest.mark.asyncio
async def test_ai_simulation_mode_pirate():
    service = AIService()
    service.client = None

    response = await service.generate_response("Find the treasure", persona="pirate")
    assert "Ahoy" in response or "matey" in response


@pytest.mark.asyncio
async def test_ai_simulation_mode_coder():
    service = AIService()
    service.client = None

    response = await service.generate_response("Write a quicksort", persona="coder")
    assert "```python" in response


@pytest.mark.asyncio
async def test_ai_simulation_summarize():
    service = AIService()
    service.client = None

    summary = await service.summarize_text("First line.\nSecond line.\nThird line.")
    assert len(summary) > 0
