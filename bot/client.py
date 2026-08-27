"""Main Discord Bot client implementation with slash commands and message listeners."""

import logging
import re
import discord
from discord.ext import commands

from bot.ai_service import ai_service
from bot.config import config
from bot.memory import memory
from bot.utils.formatter import chunk_message

logger = logging.getLogger("discord_bot.client")


class AIBot(commands.Bot):
    """Conversational AI Discord Bot subclassing commands.Bot."""

    def __init__(self):
        intents = discord.Intents.default()
        intents.message_content = True  # Required for message content and mentions

        super().__init__(
            command_prefix=config.command_prefix,
            intents=intents,
            help_command=None,  # We provide our own custom slash /help command
        )

    async def setup_hook(self) -> None:
        """Load extensions and synchronize application slash commands."""
        extensions = [
            "bot.cogs.chat",
            "bot.cogs.utility",
        ]

        for ext in extensions:
            try:
                await self.load_extension(ext)
                logger.info("Loaded extension: %s", ext)
            except Exception as e:
                logger.exception("Failed to load extension %s: %s", ext, e)

        # Synchronize slash commands globally
        try:
            synced = await self.tree.sync()
            logger.info("Synchronized %d application slash commands.", len(synced))
        except Exception as e:
            logger.exception("Failed to synchronize application commands: %s", e)

    async def on_ready(self) -> None:
        """Invoked when the bot has connected to Discord Gateway."""
        logger.info("==================================================")
        logger.info("Logged in as: %s (ID: %s)", self.user.name, self.user.id)
        logger.info("Connected to %d guild(s)", len(self.guilds))
        logger.info("Gateway Latency: %d ms", round(self.latency * 1000) if self.latency else 0)
        logger.info("==================================================")

        # Set rich presence status
        activity = discord.Activity(
            type=discord.ActivityType.listening,
            name="/chat or @mention me!",
        )
        await self.change_presence(status=discord.Status.online, activity=activity)

    async def on_message(self, message: discord.Message) -> None:
        """Handle incoming messages, processing mentions, DMs, and commands."""
        # Never reply to other bots or ourselves
        if message.author.bot:
            return

        # Check if the message is a direct message (DM) or mentions the bot
        is_dm = isinstance(message.channel, discord.DMChannel)
        is_mentioned = self.user in message.mentions and not message.mention_everyone

        if is_dm or is_mentioned:
            # Clean mention tags from text
            content = message.content
            if self.user:
                content = re.sub(rf"<@!?{self.user.id}>", "", content).strip()

            if content:
                await self._handle_conversational_reply(message, content)
                return

        # Fallback to standard prefix command processing
        await self.process_commands(message)

    async def _handle_conversational_reply(self, message: discord.Message, prompt: str) -> None:
        """Process conversational input from mention or DM with memory and typing indicator."""
        channel_id = str(message.channel.id)
        user_id = str(message.author.id)
        conv_id = f"{channel_id}:{user_id}"

        # Show typing indicator while generating response
        async with message.channel.typing():
            persona = memory.get_persona(conv_id)
            history = memory.get_messages(conv_id)

            # Record user turn
            memory.add_user_message(conv_id, prompt)

            # Generate reply
            reply_text = await ai_service.generate_response(
                prompt=prompt,
                history=history,
                persona=persona,
            )

            # Record assistant turn
            memory.add_assistant_message(conv_id, reply_text)

        # Chunk and send reply
        chunks = chunk_message(reply_text)
        first_chunk = True
        for chunk in chunks:
            if first_chunk:
                await message.reply(chunk, mention_author=False)
                first_chunk = False
            else:
                await message.channel.send(chunk)

    async def on_command_error(self, ctx: commands.Context, error: commands.CommandError) -> None:
        """Handle legacy prefix command errors gracefully."""
        if isinstance(error, commands.CommandNotFound):
            return  # Silently ignore unknown prefix commands

        logger.warning("Command error in %s: %s", ctx.command, error)
        if ctx.interaction is None:
            await ctx.send(f"⚠️ Error: `{error}`")
