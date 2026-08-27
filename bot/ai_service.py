"""AI Service handling LLM interactions (OpenAI-compatible) and smart simulation fallback."""

import logging
from typing import Dict, List, Optional

from openai import AsyncOpenAI, APIConnectionError, AuthenticationError, RateLimitError, APIError
from bot.config import config
from bot.personas import get_persona_prompt

logger = logging.getLogger("discord_bot.ai")


class AIService:
    """Provides conversational AI responses using OpenAI or compatible endpoints, with fallback simulation."""

    def __init__(self):
        self.client: Optional[AsyncOpenAI] = None
        self._initialize_client()

    def _initialize_client(self) -> None:
        """Initialize the AsyncOpenAI client if API key is present."""
        if config.is_ai_configured:
            kwargs = {"api_key": config.openai_api_key}
            if config.openai_base_url:
                kwargs["base_url"] = config.openai_base_url
            self.client = AsyncOpenAI(**kwargs)
            logger.info("OpenAI client initialized with model: %s", config.openai_model)
        else:
            self.client = None
            logger.info("AI running in Simulation / Mock mode (no valid OPENAI_API_KEY detected)")

    async def generate_response(
        self,
        prompt: str,
        history: Optional[List[Dict[str, str]]] = None,
        persona: str = "assistant",
    ) -> str:
        """Generate a response given a prompt, history, and persona."""
        # Use mock simulation if client is not configured or in mock mode
        if not self.client or config.mock_mode:
            return self._generate_simulation_response(prompt, persona)

        # Build messages payload
        system_prompt = get_persona_prompt(persona)
        messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]

        if history:
            messages.extend(history)

        messages.append({"role": "user", "content": prompt})

        try:
            response = await self.client.chat.completions.create(
                model=config.openai_model,
                messages=messages,
                max_tokens=config.max_tokens,
                temperature=config.temperature,
            )
            content = response.choices[0].message.content
            return content.strip() if content else "*(No response generated)*"

        except AuthenticationError:
            logger.error("OpenAI Authentication failed. Check your OPENAI_API_KEY in .env.")
            return (
                "⚠️ **Authentication Error**: The configured `OPENAI_API_KEY` is invalid or expired. "
                "Please update your `.env` file with a valid key."
            )
        except RateLimitError:
            logger.warning("OpenAI rate limit or quota exceeded.")
            return (
                "⚠️ **Rate Limit Exceeded**: The AI service is currently rate limited or out of credits. "
                "Please check your API account quota or try again in a moment."
            )
        except APIConnectionError as e:
            logger.error("Network connection error to AI provider: %s", e)
            return (
                "⚠️ **Connection Error**: Unable to reach the AI endpoint. "
                "Please check your network connection or `OPENAI_BASE_URL` setting."
            )
        except APIError as e:
            logger.error("OpenAI API error: %s", e)
            return f"⚠️ **AI Service Error**: {e.message or 'Unknown API error occurred.'}"
        except Exception as e:
            logger.exception("Unexpected error during AI generation: %s", e)
            return f"⚠️ **Error**: An unexpected error occurred while generating a response: `{e}`"

    async def summarize_text(self, text: str) -> str:
        """Summarize text concisely."""
        prompt = f"Please provide a clear, concise bulleted summary of the following content:\n\n{text}"
        return await self.generate_response(prompt, persona="concise")

    def _generate_simulation_response(self, prompt: str, persona: str) -> str:
        """Smart local simulation for testing without an API key."""
        lower = prompt.lower().strip()

        # Custom response for pirate persona
        if persona == "pirate":
            return (
                f"⚓ **Ahoy, matey!** Ye spoke of *'{prompt}'*!\n\n"
                f"Shiver me timbers, I be runnin' in **Offline Simulation Mode**! "
                f"Add yer `OPENAI_API_KEY` in the `.env` treasure chest to unlock me full swashbucklin' intellect!"
            )

        # Custom response for sarcastic persona
        if persona == "sarcastic":
            return (
                f"Oh wonderful, another query: *'{prompt}'*.\n\n"
                f"I would craft an exquisitely brilliant reply, but behold: I am running in **Simulation Mode** "
                f"because whoever configured this bot hasn't supplied an `OPENAI_API_KEY` yet. Truly a masterclass in planning."
            )

        # Custom response for coder persona
        if persona == "coder":
            return (
                f"```python\n"
                f"# Response to: {prompt}\n"
                f"def handle_query():\n"
                f"    status = 'Simulation Mode Active'\n"
                f"    recommendation = 'Set OPENAI_API_KEY in .env for live LLM inference'\n"
                f"    return {{'query': '{prompt}', 'status': status}}\n"
                f"```\n"
                f"💡 **Developer Note**: I'm currently running in offline mock mode. To connect to GPT-4o, Groq, or Ollama, "
                f"set your `OPENAI_API_KEY` (and optional `OPENAI_BASE_URL`) in `.env`!"
            )

        # Standard conversational responses
        if any(w in lower for w in ["hi", "hello", "hey", "greetings"]):
            return (
                "👋 **Hello!** I'm your Discord AI Assistant.\n\n"
                "I am currently running in **Simulation Mode** (no API key needed for basic testing). "
                "You can chat with me, switch personas (`/persona`), or plug in an `OPENAI_API_KEY` in your `.env` "
                "to connect live models like GPT-4o, Groq LLaMA-3, or local Ollama!"
            )

        if "who are you" in lower or "what are you" in lower:
            return (
                "🤖 I am a modular **Discord AI Conversational Bot** built with `discord.py`!\n\n"
                "**My Features:**\n"
                "• Multi-turn conversation memory per user/channel\n"
                "• Dynamic personas (`/persona`)\n"
                "• Slash commands (`/ask`, `/chat`, `/clear`, `/summarize`)\n"
                "• Support for OpenAI, Groq, OpenRouter, and Ollama\n"
                "• Smart markdown chunking for Discord limits"
            )

        # Default simulated reply
        return (
            f"🤖 **[Simulation Response]** You asked:\n> *{prompt}*\n\n"
            f"I have received your message in the **{persona.title()}** persona! "
            f"To enable live AI answers with GPT-4o or any OpenAI-compatible API:\n"
            f"1. Open `.env`\n"
            f"2. Set `OPENAI_API_KEY=sk-...`\n"
            f"3. Restart the bot!"
        )


# Global AI service instance
ai_service = AIService()
