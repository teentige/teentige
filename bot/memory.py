"""Sliding-window conversational memory manager."""

import time
from typing import Dict, List, Optional
from bot.config import config


class ConversationSession:
    """Represents an active multi-turn conversation session."""

    def __init__(self, conv_id: str, default_persona: str = "assistant"):
        self.conv_id = conv_id
        self.persona: str = default_persona
        self.messages: List[Dict[str, str]] = []
        self.last_updated: float = time.time()

    def touch(self) -> None:
        """Update the last activity timestamp."""
        self.last_updated = time.time()

    def is_expired(self, timeout_minutes: int) -> bool:
        """Check if the session has expired due to inactivity."""
        if timeout_minutes <= 0:
            return False
        return (time.time() - self.last_updated) > (timeout_minutes * 60)

    def add_message(self, role: str, content: str, max_history: int) -> None:
        """Add a message and enforce the sliding window."""
        self.touch()
        self.messages.append({"role": role, "content": content})

        # max_history counts user turns (so max messages = max_history * 2)
        max_messages = max_history * 2
        if len(self.messages) > max_messages:
            # Drop the oldest messages to maintain window
            self.messages = self.messages[-max_messages:]

    def clear(self) -> None:
        """Clear session message history."""
        self.messages.clear()
        self.touch()


class ConversationMemory:
    """Manages active conversation sessions across channels and users."""

    def __init__(
        self,
        max_history: int = 10,
        timeout_minutes: int = 30,
        default_persona: str = "assistant",
    ):
        self.max_history = max_history
        self.timeout_minutes = timeout_minutes
        self.default_persona = default_persona
        self.sessions: Dict[str, ConversationSession] = {}

    def _get_or_create(self, conv_id: str) -> ConversationSession:
        """Retrieve existing session or create a new one, resetting if expired."""
        session = self.sessions.get(conv_id)
        if session is None:
            session = ConversationSession(conv_id, default_persona=self.default_persona)
            self.sessions[conv_id] = session
        elif session.is_expired(self.timeout_minutes):
            session.clear()
            session.persona = self.default_persona

        return session

    def add_user_message(self, conv_id: str, content: str) -> None:
        """Record a message from the user."""
        session = self._get_or_create(conv_id)
        session.add_message("user", content, self.max_history)

    def add_assistant_message(self, conv_id: str, content: str) -> None:
        """Record a reply from the assistant."""
        session = self._get_or_create(conv_id)
        session.add_message("assistant", content, self.max_history)

    def get_messages(self, conv_id: str) -> List[Dict[str, str]]:
        """Return the current conversation history for the AI prompt."""
        session = self._get_or_create(conv_id)
        return list(session.messages)

    def clear(self, conv_id: str) -> bool:
        """Clear memory for a conversation. Return True if it had messages."""
        if conv_id in self.sessions:
            had_messages = len(self.sessions[conv_id].messages) > 0
            self.sessions[conv_id].clear()
            return had_messages
        return False

    def set_persona(self, conv_id: str, persona: str) -> None:
        """Set the active persona for a conversation."""
        session = self._get_or_create(conv_id)
        session.persona = persona

    def get_persona(self, conv_id: str) -> str:
        """Get the active persona for a conversation."""
        session = self._get_or_create(conv_id)
        return session.persona

    def get_active_sessions_count(self) -> int:
        """Return count of unexpired sessions."""
        now = time.time()
        timeout_seconds = self.timeout_minutes * 60
        return sum(
            1
            for s in self.sessions.values()
            if (now - s.last_updated) <= timeout_seconds
        )


# Global memory manager instance
memory = ConversationMemory(
    max_history=config.max_history,
    timeout_minutes=config.memory_timeout_minutes,
    default_persona=config.default_persona,
)
