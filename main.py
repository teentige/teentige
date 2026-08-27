"""Main entry point for starting the Discord AI Bot."""

import argparse
import sys
from bot import __version__
from bot.client import AIBot
from bot.config import config
from bot.utils.logger import setup_logger

logger = setup_logger("discord_bot")


def parse_args():
    parser = argparse.ArgumentParser(description="Discord AI Conversational Assistant Bot")
    parser.add_argument(
        "--simulate",
        action="store_true",
        help="Run interactive CLI chat simulation without connecting to Discord",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run the test suite and exit",
    )
    parser.add_argument(
        "--version",
        action="version",
        version=f"Discord AI Bot v{__version__}",
    )
    return parser.parse_args()


def run_tests():
    """Run pytest suite programmatically."""
    import pytest

    sys.exit(pytest.main(["-v", "tests"]))


def run_simulator():
    """Launch the interactive terminal simulator."""
    import subprocess

    sys.exit(subprocess.call([sys.executable, "simulate.py"]))


def main():
    args = parse_args()

    if args.test:
        run_tests()
        return

    if args.simulate:
        run_simulator()
        return

    logger.info("Starting Discord AI Bot v%s...", __version__)
    logger.info("\n%s", config.print_summary())

    if not config.discord_token or config.discord_token == "your_discord_bot_token_here":
        logger.error(
            "\n"
            "===============================================================\n"
            "❌ ERROR: DISCORD_TOKEN is missing or not set in .env!\n"
            "---------------------------------------------------------------\n"
            "To connect this bot to Discord:\n"
            "  1. Go to https://discord.com/developers/applications\n"
            "  2. Create a 'New Application', then navigate to 'Bot'\n"
            "  3. Click 'Reset Token' and copy your Bot Token\n"
            "  4. Enable 'Message Content Intent' under Privileged Gateway Intents\n"
            "  5. Create a '.env' file or copy from '.env.example':\n"
            "       DISCORD_TOKEN=your_token_here\n"
            "       OPENAI_API_KEY=your_openai_or_groq_key_here\n"
            "  6. Run: python main.py\n\n"
            "👉 Want to test the AI bot right now without a token?\n"
            "   Run: python simulate.py\n"
            "===============================================================\n"
        )
        sys.exit(1)

    bot = AIBot()
    try:
        bot.run(config.discord_token, log_handler=None)
    except Exception as e:
        logger.critical("Fatal error running bot: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
