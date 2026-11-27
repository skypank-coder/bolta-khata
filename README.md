# Bolta Khata · बोलता खाता

**The weekly Self-Help Group meeting, run by voice.** Each woman speaks her own entry, the phone reads it back to the whole group, and nothing is saved until the group says *"sahi hai"*. Every entry is locked to the one before it, so nobody can quietly change the register later.

Built for the *India Runs on Voice* hackathon (Scaler × Wispr Flow), theme: **Livelihoods and small business**.

---

## The problem

About 9 crore rural women in India save and borrow through Self-Help Groups (SHGs). Every week 10 to 15 members meet, hand over money, and one member, the bookkeeper, writes it into a paper register. Often she is the only one who can read it.

- Members cannot check what was written against their own name.
- Mistakes and misuse surface months later as fights or missing money.
- If the bookkeeper is absent or leaves, the records stop.
- Banks want clean books before lending, so messy registers cost the whole group credit.

Existing apps (such as the government's LokOS) still depend on the one member who can read and type. **Bolta Khata makes the record something the whole group hears and checks together.**

## Run it (one command)

```bash
docker compose up --build
```

Open **http://localhost:3000** in **Chrome** and allow the microphone. No keys, no `.env`, no sign-up.

No microphone? Tap the example sentences on the screen. They go through exactly the same engine as speech.

Without Docker:

```bash
npm install
npm run dev
```

## Try this (say it, or tap it)

| Say | What happens |
|---|---|
| "मीटिंग शुरू करो" / "meeting shuru karo" | Opens today's meeting and starts attendance |
| "मैं मीना हूँ", "राधा हाज़िर" | Marks members present, by name, in any accent |
| "सुनीता 100 बचत" | Two Sunitas in the group, so it asks: "सुनीता कुमारी या सुनीता यादव?" |
| "हाज़िरी पूरी" | Reads out who is present and who is absent |
| "मैं मीना, सौ रुपये बचत, पाँच सौ किस्त" | Reads it back with her new loan balance, then waits for "सही है" |
| "रेखा की किस्त दो हज़ार" | Repayment larger than the loan left, so it warns and confirms twice |
| "राधा को ढाई हज़ार लोन" | Checks group cash, then waits for the leader's "मंज़ूर" |
| "मेरा कितना जमा है?" | Speaks her own savings and loan balance |
| "पिछली एंट्री हटाओ" | Cancels the last entry by adding a reversal, never by deleting |
| "मीटिंग बंद करो" | Reads the day's totals and who paid nothing, then closes on "सही है" |

Switch to **मराठी** or **English** from the menu. Marathi works the same way ("मी मीना, शंभर रुपये बचत", "राधाला दीड हजार कर्ज").

## What makes it different

**1. The group hears every entry before it is saved.** Read-back plus spoken confirmation is the core of the product, not a feature on top. Large amounts and overpayments are confirmed twice. Only the leader's "manzoor" releases a loan, and only if the group has the cash.

**2. It understands how money is actually said in villages.** A hand-written parser (no AI guessing at amounts) handles:
- fractions: *dedh hazaar* (1,500), *dhai sau* (250), *saade teen hazaar* (3,500), *paune do hazaar* (1,750), *sava sau* (125)
- compounds: *do hazaar paanch sau*, *ek hazaar do sau pachaas*
- all Hindi numbers 1 to 99, Marathi forms (*पाचशे*, *दीड हजार*, *शंभर*), English words, digits, ₹, "2k"
- Devanagari or Roman input, because Chrome returns Devanagari for Hindi speech
- false alarms: the last "do" in "Sunita ko do hazaar do" is a verb ("give"), not 2

**3. It matches Indian names the way recognisers mishear them.** Sunita, Suneeta, Sunitha and सुनीता all reach the same member. Marathi case endings (*राधाला*) are stripped. When two members sound alike, it asks instead of guessing.

**4. A register nobody can quietly edit.** Each entry stores the SHA-256 hash of the entry before it. The *Ledger* screen has a **"Try tampering"** button: it secretly takes ₹1,000 off an old entry, and the ledger turns red at exactly that entry. Mistakes are cancelled by reversal entries, so the history is never rewritten.

**5. Made for a meeting under a tree.**
- Hands-free mode: tap once, and it listens, answers and listens again for the whole meeting.
- Works offline as an installable app (PWA). The ledger lives in IndexedDB on the phone; nothing is sent to a server.
- Every spoken question also has a big button, for noisy rooms.
- A live mic-level ring shows speakers that they are being heard.

**6. Output a bank will accept.** A meeting report (print or save as PDF), a CSV for the federation or bank, and a receipt per member that can be **read aloud** or **sent on WhatsApp**. Each receipt carries the ledger lock code.

## How it works

```
 microphone ──► Web Speech API (hi-IN / mr-IN / en-IN, with alternative guesses)
                    │
                    ▼
 transliterate (Devanagari → Roman) ─► tokenise ─► money parser ─► name matcher
                    │
                    ▼
           intent parser (start, attendance, entry, confirm, reject, approve,
                          question, undo, close)
                    │
                    ▼
     meeting state machine  ── pure function: (state, heard, ledger) → (state, reply, entries)
                    │                                   │
                    ▼                                   ▼
       reply in Hindi / Marathi / English     hash-chained ledger (SHA-256)
                    │                                   │
                    ▼                                   ▼
     speechSynthesis + sound cues               IndexedDB on the phone
```

| Folder | What is in it |
|---|---|
| `src/lib/translit.ts` | Devanagari to Roman, including Hindi schwa deletion (कितना → kitnaa) |
| `src/lib/numbers.ts` | Spoken money parser |
| `src/lib/phonetic.ts` | Indian name matching and ambiguity detection |
| `src/lib/intent.ts` | What a sentence means |
| `src/lib/meeting.ts` | The meeting as a tested state machine |
| `src/lib/ledger.ts` | Hash chain, reversals, balances |
| `src/lib/phrases.ts` | Everything the app says, in three languages |
| `src/lib/speech.ts` | Listening, speaking, sound cues, mic level |
| `src/screens/` | Meeting, Ledger and Report screens |

## Tests

```bash
npm test
```

Over 90 tests, including whole meetings driven by spoken sentences: attendance, read-back, corrections, loan approval, overpayment, cash checks, balance questions, silence and noisy input, and every example sentence shown on screen in all three languages.

## What it depends on

| Dependency | Used for | If it gets costly or stops working |
|---|---|---|
| Browser speech recognition (Chrome / Android) | Turning speech into text | Free today. The rest of the app does not care where text comes from: an on-device model or an Indian STT API (for example Sarvam or Bhashini) can be swapped in behind `listen()`. Typing and tap buttons always work. |
| Browser speech synthesis | Speaking replies | Free and on-device. If a language voice is missing, it falls back to the Hindi voice and still shows the text. |
| Nothing else | | No paid AI model, no server, no database. Parsing, matching and the ledger all run on the phone. |

## Built by voice with Wispr Flow

See the Round 2 submission note for how Wispr Flow was used to build this.

## License

MIT
