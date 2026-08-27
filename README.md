# 🤖 Discord AI Conversational Assistant Bot

A modern, full-featured, and extensible **Discord AI Chatbot** built in Python with `discord.py` (v2.x) and OpenAI-compatible LLMs (OpenAI, Groq, OpenRouter, Ollama, Together AI).

Features persistent multi-turn conversational memory, dynamic personalities (personas), Discord slash commands, auto-chunking for Discord's 2000-character limit with code block preservation, and an offline simulation fallback mode.

---

## ✨ Features

- 🧠 **Multi-Turn Conversational Memory**: Remembers context across messages with a configurable sliding-window per channel and user. Inactive sessions automatically expire.
- ⚡ **Modern Slash Commands (`/`)**: Built natively with `discord.app_commands` for autocompletion, parameter hints, and Discord UI dropdowns.
- 🎭 **Dynamic Personas**: Switch between personalities on the fly (`/persona`):
  - 🤖 **Helpful Assistant**: Friendly, polite, and versatile general assistant.
  - 💻 **Expert Programmer**: Senior developer providing clean code and debugging help.
  - 📚 **Patient Teacher**: Explains complex concepts with simple analogies (ELI5).
  - 🎨 **Creative Storyteller**: Brainstorms stories, world-building, and roleplay.
  - 😏 **Sarcastic Companion**: Witty, dry humor and snarky banter (GLaDOS style).
  - ⚓ **Seafaring Pirate**: Swashbuckling 17th-century pirate dialect.
  - 🎯 **Ultra Concise**: Direct, bullet points only, zero fluff.
- ✂️ **Smart Message Chunking**: Discord rejects messages longer than 2,000 characters. The bot splits long responses safely at paragraph/sentence boundaries and **automatically closes and re-opens markdown code fences** across chunks.
- 🔌 **Universal LLM Support**: Supports standard OpenAI API endpoints:
  - **OpenAI** (`gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`)
  - **Groq** (Ultra-fast `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`)
  - **OpenRouter** (Claude, Gemini, DeepSeek, Mistral, LLaMA)
  - **Ollama / LocalAI** (100% free, offline, local open-source models)
- 🛡️ **Offline Simulation Fallback**: Runs out of the box even before adding an API key! Fallback simulation answers queries and lets you test slash commands, personas, and memory.
- 💻 **Interactive CLI Simulator**: Test and talk with the bot directly in your terminal (`python simulate.py`) without needing Discord or tokens!
- 🐳 **Docker & Docker Compose**: Ready for 24/7 deployment on any cloud server or VPS.
- 🧪 **100% Test Coverage**: Full suite of unit tests with `pytest`.

---

## 📁 Project Structure

```text
teentige/
├── bot/
│   ├── __init__.py
│   ├── client.py           # Discord Bot client, event listeners (mentions/DMs) & sync
│   ├── config.py           # Environment config loader with secret masking
│   ├── ai_service.py       # OpenAI / LLM integration with fallback simulation
│   ├── memory.py           # Sliding-window conversation memory manager
│   ├── personas.py         # Personality definitions and prompt templates
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── formatter.py    # Smart Discord 2000-character chunker with code fences
│   │   └── logger.py       # Colorized structured console logging
│   └── cogs/
│       ├── __init__.py
│       ├── chat.py         # /ask, /chat, /clear, /persona, /model, /summarize
│       └── utility.py      # /ping, /help, /info
├── tests/
│   ├── __init__.py
│   ├── test_ai_service.py  # AI response and persona tests
│   ├── test_cogs.py        # Bot and cog initialization tests
│   ├── test_config.py      # Config loading and security tests
│   ├── test_formatter.py   # Discord chunker & markdown preservation tests
│   └── test_memory.py      # Memory sliding-window & timeout tests
├── .env.example            # Environment variables template
├── .gitignore              # Ignores venv, secrets, logs, cache
├── Dockerfile              # Production container image
├── docker-compose.yml      # Multi-container service configuration
├── main.py                 # Bot runner & CLI entry point
├── simulate.py             # Interactive local terminal chat simulator
├── requirements.txt        # Python package dependencies
└── pytest.ini              # Pytest configuration
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites

- **Python 3.10+** installed on your system.
- A **Discord Account** to create the bot application.
- *(Optional)* An API key from **OpenAI**, **Groq**, or a local **Ollama** server.

---

### 2. Discord Developer Portal Setup

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and give your bot a name (e.g., `My AI Assistant`).
3. In the left menu, navigate to **Bot**:
   - Click **Reset Token** and copy your **Bot Token** (save this for `.env`).
   - Scroll down to **Privileged Gateway Intents** and enable:
     - ✅ **Message Content Intent** (required for mentions, commands, and chat context).
4. In the left menu, navigate to **OAuth2 ➔ URL Generator**:
   - Under **Scopes**, select:
     - ✅ `bot`
     - ✅ `applications.commands`
   - Under **Bot Permissions**, select:
     - ✅ `Send Messages`
     - ✅ `Read Messages / View Channels`
     - ✅ `Read Message History`
     - ✅ `Embed Links`
   - Copy the generated URL at the bottom and paste it into your browser to invite the bot to your Discord server!

---

### 3. Installation

Clone this repository and create a Python virtual environment:

```bash
# Clone repository
git clone https://github.com/teentige/teentige.git
cd teentige

# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
# On Linux / macOS:
source .venv/bin/activate
# On Windows:
# .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

---

### 4. Configuration (`.env`)

Copy the template file:

```bash
cp .env.example .env
```

Open `.env` and fill in your keys:

```env
# Required for Discord connection
DISCORD_TOKEN=your_discord_bot_token_here

# Optional: Set your AI provider key (or leave blank to use simulation mode)
OPENAI_API_KEY=your_openai_or_groq_api_key_here
OPENAI_MODEL=gpt-4o-mini
```

---

### 5. Run the Bot

Start the Discord bot:

```bash
python main.py
```

Once connected, you will see:
```text
[2026-08-27 16:56:25] [INFO] discord_bot: Logged in as: AI Assistant#1234
[2026-08-27 16:56:25] [INFO] discord_bot: Connected to 1 guild(s)
[2026-08-27 16:56:25] [INFO] discord_bot: Synchronized 8 application slash commands.
```

---

## 💬 Test Locally Without Discord (`simulate.py`)

You can immediately test the conversational AI and personas right in your terminal:

```bash
python simulate.py
```

Example session:
```text
🤖 Discord AI Assistant — Terminal Simulator
-----------------------------------------------------------------
[assistant] You > Hello! Tell me about yourself.
Bot > 👋 Hello! I'm your Discord AI Assistant...

[assistant] You > /persona coder
🎭 Switched persona to: Expert Programmer

[coder] You > How do I reverse a string in Python?
Bot > In Python, the idiomatic way is slice notation: `s[::-1]`.
```

---

## 🎮 Discord Commands & Usage

| Command | Type | Description |
|---|---|---|
| `/chat <message>` | Slash Command | Multi-turn conversational chat that remembers context. |
| `/ask <prompt>` | Slash Command | Quick one-shot question without saving into memory. |
| `/clear` | Slash Command | Clears active conversation memory for this channel. |
| `/persona [name]` | Slash Command | Switch AI personality or view available options. |
| `/summarize [text]` | Slash Command | Summarize provided text or recent conversation history. |
| `/model` | Slash Command | Display configured AI model, provider, and settings. |
| `/ping` | Slash Command | Check websocket latency and API roundtrip time. |
| `/help` | Slash Command | Interactive help guide explaining all features. |
| `/info` | Slash Command | Uptime, system specs, connected servers, and stats. |
| `@BotName <message>` | Mention | Mention the bot in any channel to chat naturally. |
| Direct Message (DM) | DM | Message the bot directly in DMs for 1-on-1 private chat. |

---

## ⚡ Using Alternative AI Providers

The bot uses the standard OpenAI API specification, meaning you can easily switch to free or high-speed alternative providers by updating `.env`:

### Groq (Ultra Fast LLaMA 3.3)
```env
OPENAI_API_KEY=gsk_your_groq_api_key_here
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=llama-3.3-70b-versatile
```

### OpenRouter (Claude 3.5, Gemini 1.5, DeepSeek)
```env
OPENAI_API_KEY=sk-or-v1-your_openrouter_key
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_MODEL=meta-llama/llama-3.1-8b-instruct:free
```

### Ollama (100% Free & Local)
Run `ollama run llama3.2` on your machine, then configure:
```env
OPENAI_API_KEY=ollama
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_MODEL=llama3.2
```

---

## 🐳 Docker Deployment

To run the bot in the background 24/7 using Docker:

```bash
# Build and start container in detached mode
docker compose up -d

# View real-time logs
docker compose logs -f

# Stop container
docker compose down
```

---

## 🧪 Running Unit Tests

Run the test suite with `pytest`:

```bash
python main.py --test
# or
pytest
```

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
