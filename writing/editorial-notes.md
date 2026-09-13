# Writing queue — September 13, 2026

Lead draft: `local-dictation.md`, based on inspected Mac mini source, not a hypothetical build or performance claim. Destination: Medium draft for Nate's review.

## Evidence

Mac mini `~/Projects/voice2text`, HEAD `05a4677` at inspection:
- `voice2text/audio.py`: ChunkBuffer push/drain lock, RMS LevelMonitor.
- `voice2text/cli.py`: SilenceWatchdog warning and one restart; source comment describes sleep/wake/zero-frame failure.
- `voice2text/statuswindow.py`: nonactivating NSPanel, main-thread AppKit, locked ticker buffer, shared shutdown event.
- `voice2text/transcriber.py`: faster-whisper; VAD, previous-text conditioning disabled.
- `README.md` and `CLAUDE.md`: usage, local audio invariant, different meeting/dictation buffers.
- Commit `926d63d`: silence watchdog and tests; `53a4394`: Accessibility setup/injection errors.

No benchmark, user count, productivity claim, or claim of personally reproduced live microphone behavior. We inspected code; we did not run the audio app in this session.

## Next pieces

1. **A text message is not a deployment request.** Codey's explicit analyze → clarify → proposed reply → execute → preview → approve flow. Tutorial: build a per-project job queue with a review boundary. Source: Mini `codey/CLAUDE.md`, then inspect actual queue/deployer implementation before drafting. Avoid real conversations and private client details.
2. **The client doesn't get the answer key.** Whereupon's geography-game design: guesses go up, server computes scores, answers reveal after guesses. Shared Swift DTOs and round-day boundary. Source: Mini `whereupon/CLAUDE.md`; verify server handlers before a runnable tutorial.
3. **Your agent needs a mailbox, not another giant prompt.** Durable sessions, file reservations, release leases, and small coordination messages. Source: this project's agent-inbox workflow; inspect implementation before claims about delivery guarantees.
4. **One biography, twenty websites.** This site's JSON facts, independent generated documents, approvals, sandboxing, cache invalidation, no-repeat rotation. A real case study with visible artifacts and rejected designs. Publish after revised designs are reviewed.
5. **A weather station with a literary output.** George's weather/garden input → constrained diary draft → dashboard review and posting markers. Source: Mini `george/README.md` and `CLAUDE.md`. Keep household measurements, addresses, and tokens out of public examples.

## Editorial direction

Reviewed Push To Prod homepage and available excerpts:
- https://getpushtoprod.substack.com/
- https://getpushtoprod.substack.com/p/when-coding-is-cheap
- https://getpushtoprod.substack.com/p/ai-automation

Useful pattern: a concrete situation leading to an engineering argument. Our direction: firsthand build notes, a failure, a code-level decision, tradeoffs, and something a reader can try. Avoid sweeping labor-market predictions, unmeasured percentage savings, or copying the author's phrasing.

Suggested rhythm: one substantial build note every two weeks, with a short demo or focused tutorial between. Pick topics from actual changes and failure notes; don't create a content quota that requires invented lessons.
