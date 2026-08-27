"""Utility Cog implementing info, ping, and help commands."""

import platform
import time
import discord
from discord import app_commands
from discord.ext import commands

from bot import __version__
from bot.config import config
from bot.memory import memory


class UtilityCog(commands.Cog, name="Utility"):
    """Help, diagnostics, and system information commands."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.start_time = time.time()

    # Slash Command: /ping
    @app_commands.command(name="ping", description="Check bot latency and operational status.")
    async def ping(self, interaction: discord.Interaction):
        t0 = time.time()
        await interaction.response.defer()
        roundtrip_ms = round((time.time() - t0) * 1000)
        ws_latency_ms = round(self.bot.latency * 1000) if self.bot.latency else 0

        embed = discord.Embed(
            title="🏓 Pong!",
            color=discord.Color.green(),
        )
        embed.add_field(name="WebSocket Latency", value=f"`{ws_latency_ms} ms`", inline=True)
        embed.add_field(name="API Roundtrip", value=f"`{roundtrip_ms} ms`", inline=True)
        await interaction.followup.send(embed=embed)

    # Slash Command: /help
    @app_commands.command(name="help", description="Learn how to interact with the AI Bot.")
    async def help(self, interaction: discord.Interaction):
        embed = discord.Embed(
            title="🤖 Discord AI Assistant — Guide & Commands",
            description=(
                "I am your conversational AI companion! You can chat with me via slash commands, "
                "direct mentions (`@Bot`), or direct messages (DMs).\n"
            ),
            color=discord.Color.blurple(),
        )

        embed.add_field(
            name="💬 Conversational Commands",
            value=(
                "• `/chat <message>`: Multi-turn chat with contextual memory\n"
                "• `/ask <prompt>`: Single question answering (doesn't change memory)\n"
                "• `/clear`: Reset your active conversation memory in this channel\n"
                "• `/persona [name]`: Switch AI style (Coder, Teacher, Pirate, Sarcastic, etc.)\n"
                "• `/summarize [text]`: Summarize long text or recent conversation\n"
            ),
            inline=False,
        )

        embed.add_field(
            name="🛠️ Utility Commands",
            value=(
                "• `/ping`: Check bot response latency\n"
                "• `/model`: View active AI model and settings\n"
                "• `/info`: System statistics and bot information\n"
                "• `/help`: Display this help guide\n"
            ),
            inline=False,
        )

        embed.add_field(
            name="💡 Quick Tips",
            value=(
                "• Mention me anywhere (`@Bot hello!`) to chat naturally.\n"
                "• In DMs, you can message me directly without commands.\n"
                "• Long replies are automatically split safely so code snippets never break!"
            ),
            inline=False,
        )

        await interaction.response.send_message(embed=embed)

    # Slash Command: /info
    @app_commands.command(name="info", description="View bot operational statistics and environment.")
    async def info(self, interaction: discord.Interaction):
        uptime_seconds = int(time.time() - self.start_time)
        hours, rem = divmod(uptime_seconds, 3600)
        minutes, seconds = divmod(rem, 60)
        uptime_str = f"{hours}h {minutes}m {seconds}s"

        active_sessions = memory.get_active_sessions_count()
        guild_count = len(self.bot.guilds)

        embed = discord.Embed(
            title="📊 Bot Information & Statistics",
            color=discord.Color.dark_theme(),
        )
        embed.add_field(name="Bot Version", value=f"`v{__version__}`", inline=True)
        embed.add_field(name="discord.py", value=f"`v{discord.__version__}`", inline=True)
        embed.add_field(name="Python", value=f"`{platform.python_version()}`", inline=True)
        embed.add_field(name="Uptime", value=f"`{uptime_str}`", inline=True)
        embed.add_field(name="Servers (Guilds)", value=f"`{guild_count}`", inline=True)
        embed.add_field(name="Active Memory Sessions", value=f"`{active_sessions}`", inline=True)
        embed.add_field(name="AI Provider Mode", value="`Live API`" if config.is_ai_configured else "`Simulation Mode`", inline=True)
        embed.add_field(name="Active Model", value=f"`{config.openai_model}`", inline=True)

        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot):
    """Load the UtilityCog extension."""
    await bot.add_cog(UtilityCog(bot))
