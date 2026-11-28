# Recording kit: the 3-minute demo

Record the real product, with your real voice talking to it. That is what the judges ask for ("show the core flow working end to end by voice"), and a live take where the app hears you and answers is the most convincing thing you can show.

---

## 1. Set up (10 minutes, once)

1. Start the app: `docker compose up --build`, then open **http://localhost:3000**.
2. Use **Microsoft Edge** if you can (its Hindi voices, Swara and Madhur, sound the most natural), otherwise Chrome.
3. Open a **new InPrivate / Incognito window** (`Ctrl+Shift+N`). This gives a clean start: Sakhi greets you, and no old data shows.
4. Allow the **microphone** when asked. Turn the **speaker volume up**, so the app's replies are clearly heard in the recording.
5. Check the voice once: in any group, ☰ menu → *आवाज़* → **सुनकर देखिए** (Test it). Pick the clearest voice and *सामान्य* speed.
6. Press `F11` for full screen, close other apps, and turn on *Do not disturb* so no pop-ups appear.
7. Sit in a quiet room, about an arm's length from the laptop mic.

## 2. Record (built into Windows 11, nothing to install)

**Option A: Clipchamp** (Start menu → Clipchamp → *Record* → *Screen and camera*). Choose the browser tab or screen, turn on the microphone, record, then trim and export in the same app. Best choice: you can cut mistakes and add a title.

**Option B: Xbox Game Bar.** Press `Win+G` → Settings → *Capturing* → turn on **"Record audio: Game"** and **microphone**. Then `Win+Alt+R` starts and stops recording of the browser window. Files go to `Videos\Captures`.

Do two or three takes; keep the best one. Export as MP4 and upload to YouTube as **Unlisted**.

---

## 3. The script (3:00)

*Lines in italics are what you say to the camera or viewer (English is fine for judges). Lines in quotes are what you say to the app; speak them a little slowly.*

| Time | On screen | What you do and say |
|---|---|---|
| **0:00–0:15** | Website hero (Hindi) | *"Nine crore women in India save money in Self-Help Groups. Every week, one woman writes it in a register that only she can read. Everyone else has to trust her. Bolta Khata runs that meeting by voice."* |
| **0:15–0:25** | Sakhi Didi appears | Let Sakhi speak her first line, then press **छोड़िए** (Skip). *"Sakhi, our guide, explains every screen aloud. Judges can try it in one click."* |
| **0:25–0:35** | Press **▶ एक क्लिक में आज़माइए** | The group opens; when Sakhi starts the meeting tour, press **छोड़िए**. *"A real group with twelve members, saved online. Now I'll run a meeting, only by voice."* |
| **0:35–0:55** | Press the mic once (it keeps listening) | "मीटिंग शुरू करो" → "मैं मीना हूँ" → "राधा हाज़िर" → "सुनीता". It asks *सुनीता कुमारी या सुनीता यादव?* → "यादव". *(Point at the seats filling in.)* "हाज़िरी पूरी" |
| **0:55–1:20** | The read-back and stamp | "मैं मीना, दो सौ रुपये बचत". Pause while it reads back and the words light up. "सही है" → stamp, coins fly into the pot. *"It reads every entry back to the whole group. Nothing is written until they say sahi hai."* |
| **1:20–1:40** | The loan | "राधा को ढाई हज़ार लोन" → it shows the group cash before and after. "मंज़ूर" → coins fly to Radha. *"Only the leader's word releases a loan, and only if the group has the cash."* |
| **1:40–1:50** | A member's question | "मेरा कितना जमा है?" → it speaks Radha's savings and loan. |
| **1:50–2:15** | Close and cash count | "मीटिंग बंद करो" → summary. "हाथ में अठारह हज़ार एक सौ है" → *it says ₹100 short and records it.* "सही है" → petals. *"Cash that does not match the register is where SHG money goes missing. Now it is checked at every meeting, by voice."* |
| **2:15–2:35** | **खाता** (Ledger) tab, then **रिपोर्ट** (Report) | Scroll the ledger: *"Every entry is locked to the one before it with a hash, so nobody can quietly change it."* In Report, press **सुनाएँ** (Play) on one receipt. *"A bank-ready report, and a receipt every member can hear."* |
| **2:35–2:50** | Switch language (☰ → English), then back | *"Hindi first, and also Marathi and English. It understands money the way villages say it: dedh hazaar, paune do hazaar."* |
| **2:50–3:00** | Website hero | *"Bolta Khata. Speak, listen, sahi hai. The code runs with one command; the link is in the description."* |

**The cash number:** the one-click group starts with ₹20,500 in cash. After Meena's ₹200 savings and Radha's ₹2,500 loan, it should hold ₹18,200, so saying **"अठारह हज़ार एक सौ"** (18,100) shows the "₹100 short" moment. If you change any amount, the screen shows the right total before you count.

## 4. If something goes wrong on camera

- **It mishears:** say "ग़लत है" and repeat. That shows the safety net working; keep it in the video.
- **It doesn't hear you:** tap the line under *अब बोलिए* (Now say) instead, then carry on speaking.
- **Too long:** cut the language switch (2:35–2:50) first, then shorten the narration lines.
- **No mic at all on the recording machine:** website → *बिना इंटरनेट डेमो* (Offline demo) → **पूरी डेमो मीटिंग चलाइए** plays a whole meeting by itself; narrate over it. (A live take is stronger, so use this only as a fallback.)

## 5. YouTube description (paste)

> Bolta Khata (बोलता खाता): the Self-Help Group meeting, run by voice in Hindi, Marathi and English. Each member speaks her entry, the phone reads it back to the whole group, and it is written only after "sahi hai", then hash-locked. Built for India Runs on Voice (Scaler × Wispr Flow).
> Code: https://github.com/skypank-coder/bolta-khata · Run: `docker compose up` → http://localhost:3000
