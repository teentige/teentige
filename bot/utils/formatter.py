"""Message formatter and chunker for Discord's 2000-character limit."""

import re
from typing import List

MAX_DISCORD_MESSAGE_LENGTH = 1900  # Leave buffer below 2000 for safety

CODE_BLOCK_PATTERN = re.compile(r"```([a-zA-Z0-9_-]*)")


def chunk_message(text: str, max_length: int = MAX_DISCORD_MESSAGE_LENGTH) -> List[str]:
    """Split a long text into chunks that fit Discord's message limit.

    Respects code blocks, ensuring open code blocks are properly closed in the current
    chunk and reopened in the subsequent chunk.
    """
    if not text:
        return [""]

    if len(text) <= max_length:
        return [text]

    chunks: List[str] = []
    remaining = text
    current_code_lang: str | None = None

    while remaining:
        # Prepend code block opening if a code block was carried over
        prefix = f"```{current_code_lang}\n" if current_code_lang is not None else ""
        allowed_len = max_length - len(prefix)

        if len(remaining) <= allowed_len:
            chunks.append(prefix + remaining)
            break

        # Candidate segment
        candidate = remaining[:allowed_len]

        # Find best split point
        split_index = _find_split_index(candidate)

        chunk_content = remaining[:split_index]
        remaining = remaining[split_index:].lstrip("\r\n")

        # Track code blocks in chunk_content
        # Check if code block status changes
        code_markers = [m for m in re.finditer(r"```([a-zA-Z0-9_-]*)", chunk_content)]
        
        # If we had a carry-over prefix, count that as starting in code block
        in_code_block = current_code_lang is not None
        for marker in code_markers:
            if not in_code_block:
                in_code_block = True
                lang = marker.group(1)
                current_code_lang = lang if lang else ""
            else:
                in_code_block = False
                current_code_lang = None

        if in_code_block:
            # We must close the code block for this chunk
            suffix = "\n```"
            chunks.append(prefix + chunk_content + suffix)
        else:
            chunks.append(prefix + chunk_content)
            current_code_lang = None

    return [c for c in chunks if c.strip()]


def _find_split_index(candidate: str) -> int:
    """Find a natural split point (paragraphs, newlines, sentences, or spaces)."""
    # 1. Paragraph boundary (\n\n) in the last 40% of candidate
    min_split = int(len(candidate) * 0.5)
    last_paragraph = candidate.rfind("\n\n")
    if last_paragraph >= min_split:
        return last_paragraph + 2

    # 2. Line boundary (\n) in the last 30% of candidate
    last_newline = candidate.rfind("\n")
    if last_newline >= min_split:
        return last_newline + 1

    # 3. Sentence boundary (. , ! , ? )
    for punct in [". ", "! ", "? "]:
        idx = candidate.rfind(punct)
        if idx >= min_split:
            return idx + len(punct)

    # 4. Word boundary (space)
    last_space = candidate.rfind(" ")
    if last_space >= min_split:
        return last_space + 1

    # 5. Fallback to candidate length
    return len(candidate)
