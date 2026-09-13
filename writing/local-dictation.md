# I built a dictation app. The hard part wasn’t transcription.

A speech-to-text demo has a very satisfying finish line: you talk, words appear.

A dictation tool has a different finish line: the right words appear in the right app, once, and the whole thing still works after your Mac wakes up.

I’ve been building a small local dictation tool called voice2text. It takes microphone audio, runs it through faster-whisper, and types into whatever text box is focused. Double-tap Right Shift to pause or resume. There’s a small status panel and a menu bar icon. Meeting mode writes notes with speaker labels.

The interesting engineering is mostly around that middle step.

## The same audio shouldn’t become new text twice

One tempting way to transcribe continuously is to keep the last thirty seconds of audio and send the window through the model every tick.

That gives the model context. It also gives you a reconciliation problem.

The next transcription may phrase the same audio slightly differently. Punctuation moves. A partial sentence becomes a complete sentence. If your output is a text box in another application, you can’t treat every new result as text to append. You’ve already typed part of it.

String deduplication is a brittle place to hide this problem. The model is allowed to change its mind; the text field has already moved on.

For dictation, I use a drain-based buffer. The microphone callback adds samples. The transcription loop takes everything accumulated since its previous call and clears the buffer under a lock. The next call gets only fresh audio.

The useful invariant is small enough to test: draining the buffer twice without pushing more audio returns an empty result the second time.

That does not magically solve streaming transcription. A fixed chunk boundary can split a word or sentence. Shorter chunks trade context for responsiveness, and the cadence still needs tuning. But it removes one source of duplicate output before the model is involved.

Meeting mode has a different requirement. Speaker identification benefits from a longer context window, so it keeps a ring buffer for that work while separating the fresh audio used for transcription. Two buffers, because these are two different jobs.

## The pause button can break the product

The status window sounds like a cosmetic detail until you remember what the app does: it types into the focused application.

If clicking the pause or resume button gives keyboard focus to the status window, the next words can go to the wrong place. A perfectly functional button can make the application incorrect.

The macOS implementation uses a non-activating AppKit NSPanel. It can sit above the working application without taking over its keyboard focus. The panel also stays visible when the app is inactive, which is most of the time for a dictation utility.

That decision affects the threading model. AppKit owns the main thread. Transcription runs on a worker. The worker hands transcript updates to a locked buffer, and a timer updates the panel on the UI thread. Shutdown uses a shared event so quitting from the menu and stopping from the terminal follow the same path.

None of this makes the model more accurate. It makes the tool possible to use.

## A running process can still be doing nothing

There’s another failure recorded in the project: after sleep and wake, or a microphone disconnect, the audio callback can keep delivering frames filled with zeros.

No exception. The process is alive. The transcription loop is running. The speech filter rejects the silence, and nothing appears.

Looking only at transcription output makes it hard to tell whether the model missed your words or the microphone never captured them.

The app measures audio level separately from transcription. A watchdog counts consecutive silent ticks, warns, and makes one bounded attempt to restart the microphone stream. It also tells you to check microphone selection, mute, and permissions.

Silence is only a signal, not a diagnosis. A quiet room is allowed to be quiet. The point is to make the input visible and attempt a limited recovery, rather than retry forever or pretend a live process means a healthy tool.

## Test the boundaries

If you’re building something similar, start with four checks:

- Feed known samples into the buffer. Drain it. Drain it again. Confirm the second result is empty.
- Pause typing while audio continues. Resume and check that paused speech is not dumped into the active app.
- Click the status control while a document is focused. Confirm the document remains the typing destination.
- Disconnect the microphone or put the machine to sleep. Check the input-level signal and recovery behavior, not just whether the process survived.

These checks cross the boundaries between audio capture, inference, UI state, and the operating system. That’s where a successful component can still produce a broken experience.

For local dictation, I also keep the audio path in memory. Audio does not need to become a temporary file just to pass from one library to another. Model downloads happen during setup; transcription runs locally. Meeting transcripts are an intentional output, not an incidental audio log.

A better model may improve recognition. It won’t decide whether a pause button is allowed to steal focus, whether an audio sample has already been consumed, or whether silence means the microphone stopped working.

Those decisions are still ours.
