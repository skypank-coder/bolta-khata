# Round 2 submission text

Ready-to-paste text for each field of the submission form. Edit freely; keep it true.

---

## Theme
Livelihoods and small business

## This build is
An extension of my Round 1 idea

## Pain point being solved

Over 9 crore rural women in India save and borrow through about 90 lakh Self-Help Groups. Every week, 10 to 15 members hand over money, and one member writes it into a paper register that often only she can read. Members cannot check what was written against their own name, mistakes and misuse surface months later as fights or missing money, the records stop when the bookkeeper is absent, and the cash in the box rarely matches the register. Banks want clean books before lending, so a messy register costs the whole group credit. Existing apps such as LokOS are typed by the same bookkeeper, so one woman stays in control. The meeting already happens out loud; the record does not.

## Impact in real-world India

Bolta Khata runs the weekly SHG meeting by voice in Hindi, Marathi and English. Each member speaks her own entry ("main Meena, sau rupaye bachat"), the phone reads it back to the whole group, and it is written only after the group says "sahi hai". Entries are hash-locked, so nobody can quietly change the register, and the cash box is counted by voice and checked against the khata at every meeting. Members can ask their own balance at any time; leaders get the bank report and a receipt for every member automatically; NGO workers and bank officers follow groups live with a join code. It works offline, costs nothing per meeting, and needs no training: a coach shows the exact words to say next and Sakhi Didi, an animated guide, explains every screen aloud. Pilot targets: 80% of members able to state their own balance, under 2% mismatch with the paper register, a 15-member meeting recorded in under 30 minutes.

## 3-minute screen recording
Show the core flow by voice: see `docs/DEMO_SCRIPT.md`.

## GitHub project link
https://github.com/skypank-coder/bolta-khata

## How you used Wispr Flow to build

I built Bolta Khata by talking. With Wispr Flow running, I spoke every instruction, feature idea and bug report to my AI coding assistant in Hinglish, the way I would explain it to a teammate, instead of typing.

What I said became the product. I asked for a lady animation that appears when the site opens and explains how it works, and that became Sakhi Didi, the animated guide who walks every new user through the site and the meeting by voice. I asked to make the voice better and clearer, and the app now picks the most natural Hindi voice on the device and speaks one sentence at a time. Looking at the sign-up screen I said "the box filling is not that visible", and the form was redesigned. I asked to "stress test and fix bugs", and that found nine real bugs, including "tees" (30) being saved as ₹23.

Speaking also shaped how I designed it. Because I described everything out loud, I described it the way an SHG member would experience it: what she says, what the phone says back, and what happens when it mishears. Flow followed me as I switched between Hindi and English mid-sentence, which is exactly what Bolta Khata has to do for its users, so I was testing the core idea of the product while building it.
