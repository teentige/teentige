"""Unit tests for conversation memory manager."""

import time
from bot.memory import ConversationMemory


def test_memory_add_and_retrieve():
    mem = ConversationMemory(max_history=5, timeout_minutes=30)
    conv_id = "channel_1:user_1"

    mem.add_user_message(conv_id, "Hello!")
    mem.add_assistant_message(conv_id, "Hi there, how can I help?")

    history = mem.get_messages(conv_id)
    assert len(history) == 2
    assert history[0] == {"role": "user", "content": "Hello!"}
    assert history[1] == {"role": "assistant", "content": "Hi there, how can I help?"}


def test_sliding_window_truncation():
    # max_history = 2 means at most 4 messages (2 user + 2 assistant)
    mem = ConversationMemory(max_history=2, timeout_minutes=30)
    conv_id = "test_sliding"

    for i in range(5):
        mem.add_user_message(conv_id, f"User msg {i}")
        mem.add_assistant_message(conv_id, f"Bot reply {i}")

    history = mem.get_messages(conv_id)
    assert len(history) == 4
    # Oldest retained message should be user msg 3
    assert history[0]["content"] == "User msg 3"
    assert history[-1]["content"] == "Bot reply 4"


def test_clear_memory():
    mem = ConversationMemory(max_history=5)
    conv_id = "test_clear"

    mem.add_user_message(conv_id, "Testing")
    assert len(mem.get_messages(conv_id)) == 1

    cleared = mem.clear(conv_id)
    assert cleared is True
    assert len(mem.get_messages(conv_id)) == 0

    # Clearing again should return False
    assert mem.clear(conv_id) is False


def test_persona_setting_and_isolation():
    mem = ConversationMemory(default_persona="assistant")
    conv_1 = "c1:u1"
    conv_2 = "c2:u2"

    assert mem.get_persona(conv_1) == "assistant"
    mem.set_persona(conv_1, "coder")

    assert mem.get_persona(conv_1) == "coder"
    # conv_2 remains default
    assert mem.get_persona(conv_2) == "assistant"


def test_session_timeout_expiration():
    # Timeout set to 0.001 minutes (~0.06 seconds)
    mem = ConversationMemory(max_history=5, timeout_minutes=0.001)
    conv_id = "test_timeout"

    mem.add_user_message(conv_id, "Old message")
    time.sleep(0.1)

    # Calling get_messages after timeout should return empty history
    history = mem.get_messages(conv_id)
    assert len(history) == 0
