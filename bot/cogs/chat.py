"""Chat Cog implementing slash commands for AI interaction."""

import discord
from discord import app_commands
from discord.ext import commands

from bot.ai_service import ai_service
from bot.config import config
from bot.memory import memory
from bot.personas import PERSONAS, list_personas
from bot.utils.formatter import chunk_message


class ChatCog(commands.Cog, name="Chat"):
    """Conversational AI commands and memory management."""

    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def _get_conv_id(self, interaction: discord.Interaction) -> str:
        """Create a conversation key scoped by channel and user."""
        channel_id = interaction.channel_id or "dm"
        return f"{channel_id}:{interaction.user.id}"

    # Slash Command: /ask
    @app_commands.command(name="ask", description="Ask the AI a one-off question without saving context.")
    @app_commands.describe(prompt="The question or prompt to ask the AI")
    async def ask(self, interaction: discord.Interaction, prompt: str):
        await interaction.response.defer(thinking=True)

        conv_id = self._get_conv_id(interaction)
        persona = memory.get_persona(conv_id)

        response_text = await ai_service.generate_response(
            prompt=prompt,
            history=None,
            persona=persona,
        )

        chunks = chunk_message(response_text)
        await interaction.followup.send(chunks[0])
        for chunk in chunks[1:]:
            await interaction.followup.send(chunk)

    # Slash Command: /chat
    @app_commands.command(name="chat", description="Chat with the AI retaining multi-turn memory.")
    @app_commands.describe(message="Your message to the AI")
    async def chat(self, interaction: discord.Interaction, message: str):
        await interaction.response.defer(thinking=True)

        conv_id = self._get_conv_id(interaction)
        persona = memory.get_persona(conv_id)

        # Get existing history
        history = memory.get_messages(conv_id)

        # Record user message
        memory.add_user_message(conv_id, message)

        # Generate response with memory
        response_text = await ai_service.generate_response(
            prompt=message,
            history=history,
            persona=persona,
        )

        # Record assistant reply
        memory.add_assistant_message(conv_id, response_text)

        # Send response chunks
        chunks = chunk_message(response_text)
        await interaction.followup.send(chunks[0])
        for chunk in chunks[1:]:
            await interaction.followup.send(chunk)

    # Slash Command: /clear
    @app_commands.command(name="clear", description="Clear your conversation memory in this channel.")
    async def clear(self, interaction: discord.Interaction):
        conv_id = self._get_conv_id(interaction)
        cleared = memory.clear(conv_id)

        if cleared:
            embed = discord.Embed(
                title="🧹 Memory Cleared",
                description="Your conversation history in this channel has been reset.",
                color=discord.Color.green(),
            )
        else:
            embed = discord.Embed(
                title="ℹ️ No Active History",
                description="You don't have any saved conversation turns in this channel.",
                color=discord.Color.blue(),
            )
        await interaction.response.send_message(embed=embed)

    # Slash Command: /persona
    @app_commands.command(name="persona", description="View or switch the AI personality.")
    @app_commands.describe(name="Select a persona to activate")
    @app_commands.choices(
        name=[
            app_commands.Choice(name=f"{v['name']} ({k})", value=k)
            for k, v in PERSONAS.items()
        ]
    )
    async def persona(self, interaction: discord.Interaction, name: app_commands.Choice[str] = None):
        conv_id = self._get_conv_id(interaction)

        if name is None:
            # Display current persona and list options
            current = memory.get_persona(conv_id)
            current_info = PERSONAS.get(current, PERSONAS["assistant"])

            embed = discord.Embed(
                title="🎭 AI Personas",
                description=f"Current persona: **{current_info['name']}** (`{current}`)\n\n"
                            f"Use `/persona [name]` to switch!",
                color=discord.Color.purple(),
            )
            for p in list_personas():
                prefix = "👉 " if p["id"] == current else "• "
                embed.add_field(
                    name=f"{prefix}{p['name']} (`{p['id']}`)",
                    value=p["description"],
                    inline=False,
                )
            await interaction.response.send_message(embed=embed)
        else:
            chosen = name.value
            memory.set_persona(conv_id, chosen)
            chosen_info = PERSONAS[chosen]
            embed = discord.Embed(
                title="🎭 Persona Updated",
                description=f"Personality set to **{chosen_info['name']}**!\n> *{chosen_info['description']}*",
                color=discord.Color.gold(),
            )
            await interaction.response.send_message(embed=embed)

    # Slash Command: /summarize
    @app_commands.command(name="summarize", description="Summarize text or recent conversation.")
    @app_commands.describe(text="Optional text to summarize (summarizes recent chat if omitted)")
    async def summarize(self, interaction: discord.Interaction, text: str = None):
        await interaction.response.defer(thinking=True)
        conv_id = self._get_conv_id(interaction)

        if text is None:
            history = memory.get_messages(conv_id)
            if not history:
                await interaction.followup.send(
                    "⚠️ No conversation history found in this channel to summarize. "
                    "Provide text directly: `/summarize text:Your long text here`."
                )
                return
            formatted_history = "\n".join(
                [f"{msg['role'].capitalize()}: {msg['content']}" for msg in history]
            )
            text_to_summarize = f"Recent conversation:\n{formatted_history}"
        else:
            text_to_summarize = text

        summary = await ai_service.summarize_text(text_to_summarize)
        chunks = chunk_message(f"📋 **Summary:**\n\n{summary}")
        await interaction.followup.send(chunks[0])
        for chunk in chunks[1:]:
            await interaction.followup.send(chunk)

    # Slash Command: /model
    @app_commands.command(name="model", description="View current AI backend model information.")
    async def model(self, interaction: discord.Interaction):
        status = "Live" if config.is_ai_configured else "Simulation Mode"
        provider = config.openai_base_url or "Official OpenAI API"

        embed = discord.Embed(
            title="⚙️ AI Model Information",
            color=discord.Color.teal(),
        )
        embed.add_field(name="Current Model", value=f"`{config.openai_model}`", inline=True)
        embed.add_field(name="Status", value=status, inline=True)
        embed.add_field(name="Provider Base URL", value=f"`{provider}`", inline=False)
        embed.add_field(name="Max Output Tokens", value=f"`{config.max_tokens}`", inline=True)
        embed.add_field(name="Temperature", value=f"`{config.temperature}`", inline=True)
        embed.add_field(name="Memory Window", value=f"`{config.max_history}` turns", inline=True)

        await interaction.response.send_message(embed=embed)


async def setup(bot: commands.Bot):
    """Load the ChatCog extension."""
    await bot.add_cog(ChatCog(bot))
