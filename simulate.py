"""Interactive terminal chat simulation for testing the bot locally."""

import asyncio
import sys

from bot.ai_service import ai_service
from bot.config import config
from bot.memory import memory
from bot.personas import PERSONAS, list_personas


async def interactive_session():
    conv_id = "local_terminal_user"

    print("=" * 65)
    print("🤖 Discord AI Assistant — Terminal Simulator")
    print("=" * 65)
    print(f"Status: {'Live AI Connected' if config.is_ai_configured else 'Offline Simulation Mode'}")
    if config.is_ai_configured:
        print(f"Model:  {config.openai_model}")
        print(f"Base:   {config.openai_base_url or 'https://api.openai.com/v1'}")
    else:
        print("Tip:    Set OPENAI_API_KEY in .env to connect live LLMs (OpenAI, Groq, etc.)")
    print("-" * 65)
    print("Commands:")
    print("  /persona [name]  - Change or view persona (e.g. coder, pirate, teacher)")
    print("  /clear           - Clear conversational memory")
    print("  /summarize       - Summarize the current conversation")
    print("  /exit or exit    - Quit the simulator")
    print("=" * 65)
    print()

    while True:
        try:
            current_persona = memory.get_persona(conv_id)
            user_input = input(f"[{current_persona}] You > ").strip()
        except (KeyboardInterrupt, EOFError):
            print("\nExiting simulator. Goodbye!")
            break

        if not user_input:
            continue

        if user_input.lower() in ("exit", "quit", "/exit"):
            print("Exiting simulator. Goodbye!")
            break

        if user_input == "/clear":
            memory.clear(conv_id)
            print("🧹 Conversation memory cleared!\n")
            continue

        if user_input.startswith("/persona"):
            parts = user_input.split(maxsplit=1)
            if len(parts) == 1:
                print("\nAvailable Personas:")
                for p in list_personas():
                    marker = "👉 " if p["id"] == current_persona else "   "
                    print(f"{marker}{p['id']:<10} - {p['name']}: {p['description']}")
                print()
            else:
                chosen = parts[1].lower().strip()
                if chosen in PERSONAS:
                    memory.set_persona(conv_id, chosen)
                    print(f"🎭 Switched persona to: {PERSONAS[chosen]['name']}\n")
                else:
                    print(f"⚠️ Unknown persona '{chosen}'. Available: {', '.join(PERSONAS.keys())}\n")
            continue

        if user_input.startswith("/summarize"):
            history = memory.get_messages(conv_id)
            if not history:
                print("⚠️ No history to summarize yet. Chat first!\n")
                continue
            formatted = "\n".join([f"{m['role'].capitalize()}: {m['content']}" for m in history])
            print("\nGenerating summary...")
            summary = await ai_service.summarize_text(f"Conversation:\n{formatted}")
            print(f"\n📋 Summary:\n{summary}\n")
            continue

        # Chat interaction
        history = memory.get_messages(conv_id)
        memory.add_user_message(conv_id, user_input)

        print("\nThinking...", end="\r", flush=True)
        response = await ai_service.generate_response(
            prompt=user_input,
            history=history,
            persona=current_persona,
        )
        memory.add_assistant_message(conv_id, response)

        print(f"Bot > {response}\n")


def main():
    asyncio.run(interactive_session())


if __name__ == "__main__":
    main()
