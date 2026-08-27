"""Unit tests for bot cog loading and commands."""

import pytest
from bot.client import AIBot
from bot.cogs.chat import ChatCog
from bot.cogs.utility import UtilityCog


@pytest.mark.asyncio
async def test_bot_initialization():
    bot = AIBot()
    assert bot.command_prefix == "!"
    assert bot.intents.message_content is True


@pytest.mark.asyncio
async def test_cogs_instantiation():
    bot = AIBot()
    chat_cog = ChatCog(bot)
    utility_cog = UtilityCog(bot)

    assert chat_cog.bot == bot
    assert utility_cog.bot == bot
