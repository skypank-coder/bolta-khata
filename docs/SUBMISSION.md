# Round 2 submission: what to fill in

| Form field | What to enter |
|---|---|
| This build is | **An extension of my Round 1 idea** |
| Project name | **Bolta Khata** |
| Theme | **Livelihoods and small business** |
| State | The state where you are based |
| 1 · Code on GitHub | https://github.com/skypank-coder/bolta-khata |
| 2 · YouTube demo | Your unlisted YouTube link (3 minutes or less; script in `docs/DEMO_SCRIPT.md`) |
| 3 · Pitch deck (PDF) | `docs/Bolta-Khata-Pitch-Deck.pdf` (16 pages, under 1 MB) |
| 4 · Live link (optional) | Leave empty unless you deploy it; never a reason to fail |

**Before you submit:** keep the GitHub repo public and the YouTube video public or unlisted **until 2 Dec**, because the team will test every link. Tick the four checkboxes only after checking each one.

**The deck covers every required topic, in this order:** problem and solution (slides 1–5), product and proof (6–8), addressable market (9–10), third-party dependencies with their cost and availability risks (11–12), and the go-to-market plan (13–15). Only the text is read, so every key point is written as text.

---

## Short descriptions (if anyone asks, or for social posts)

**Pain point.** Over 9 crore rural women save and borrow through about 90 lakh Self-Help Groups. One member writes the money into a paper register that often only she can read, so members cannot check their own entries, mistakes surface months later, cash rarely matches the register, and banks hesitate to lend.

**Impact.** Bolta Khata runs the weekly SHG meeting by voice in Hindi, Marathi and English. Each member speaks her entry, the phone reads it back to the whole group, and it is written only after "sahi hai", then hash-locked so nobody can quietly change it. The cash box is counted by voice at every meeting, members can ask their own balance any time, leaders get the bank report and receipts automatically, and NGO workers follow groups live. It works offline, costs nothing per meeting, and needs no training.

---

## How you used Wispr Flow to build

I built Bolta Khata by talking. With Wispr Flow running, I spoke every instruction, feature idea and bug report to my AI coding assistant in Hinglish, the way I would explain it to a teammate, instead of typing.

What I said became the product. I asked for a lady animation that appears when the site opens and explains how it works, and that became Sakhi Didi, the animated guide who walks every new user through the site and the meeting by voice. I asked to make the voice better and clearer, and the app now picks the most natural Hindi voice on the device and speaks one sentence at a time. Looking at the sign-up screen I said "the box filling is not that visible", and the form was redesigned. I asked to "stress test and fix bugs", and that found nine real bugs, including "tees" (30) being saved as ₹23.

Speaking also shaped how I designed it. Because I described everything out loud, I described it the way an SHG member would experience it: what she says, what the phone says back, and what happens when it mishears. Flow followed me as I switched between Hindi and English mid-sentence, which is exactly what Bolta Khata has to do for its users, so I was testing the core idea of the product while building it.
