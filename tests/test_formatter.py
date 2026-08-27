"""Unit tests for Discord message chunker and formatter."""

from bot.utils.formatter import chunk_message, MAX_DISCORD_MESSAGE_LENGTH


def test_short_message_returns_single_chunk():
    text = "Hello world! This is a simple short message."
    chunks = chunk_message(text)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_empty_string():
    assert chunk_message("") == [""]


def test_long_message_splits_within_bounds():
    # Generate 5000 characters of text with paragraph breaks
    paragraphs = [f"Paragraph {i}: " + ("word " * 60) for i in range(15)]
    text = "\n\n".join(paragraphs)
    assert len(text) > 3000

    chunks = chunk_message(text, max_length=1000)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 1000


def test_code_block_preservation_across_chunks():
    # Long code block exceeding max_length
    code_lines = [f"    print('Line {i}: ' + 'x' * 30)" for i in range(50)]
    code_text = "```python\ndef example():\n" + "\n".join(code_lines) + "\n```"

    limit = 500
    chunks = chunk_message(code_text, max_length=limit)

    assert len(chunks) > 1

    # First chunk must end with closing code fence ```
    assert chunks[0].strip().endswith("```")

    # Second chunk must begin with opening code fence ```python
    assert chunks[1].strip().startswith("```python")
