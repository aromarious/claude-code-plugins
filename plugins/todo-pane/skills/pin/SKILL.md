---
name: pin
description: Pin something to the Pins pane of this session's side pane
argument-hint: "[what to pin]"
disable-model-invocation: true
---

Pin content to this session's pin file (its path is given at the end of this prompt, or in the pin instruction in your context), which the Pins pane shows.

What to pin: $ARGUMENTS

- If the line above is empty, pin the main content of your most recent reply (the explanation, comparison table or summary you just gave).
- Otherwise pin what it describes: find it in the conversation, or produce it if the request asks for it (for example a translation or a shorter version).
- Append a new `## <short title>` section with the content as Markdown. Create the file if it is missing, and keep the existing pins. Remove or replace a pin only if the user asked.
- Keep it concise and self-contained, so it reads well later without the conversation.
- Afterwards, say in one line what was pinned.
