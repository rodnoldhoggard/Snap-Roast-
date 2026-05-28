# Snap Roast — Multiplayer Party Game

Snap Roast is a mobile-first, high-energy, real-time multiplayer party game designed for groups to gather, get absurd prompts, submit fast roasts, and vote on the funniest responses. 

Inspired by classic games like Jackbox and Kahoot, Snap Roast requires no app installation, is fully responsive across both Android and iOS devices, and runs seamlessly in any modern mobile web browser.

---

## 🚀 Speed and Voting Scoring Rules

* **Speed Bonus:**
  * **⚡ First to Submit:** `+2 pts`
  * **⚡ Second to Submit:** `+1 pt`
* **Vote Bonus:**
  * **🏆 Roast with the Most Votes:** `+3 pts` (If there is a tie, all tied authors get `+3 pts`)
* **Penalty:** Players who don't submit an answer inside the 20-second window receive `0 pts`.

---

## 🕹️ Game Screens

1. **Home Screen:** Enter your nickname and either Create a Room (as Host) or Join a Room (as Player).
2. **Host Lobby:** View the 4-digit invite room code. Tap the code to copy the direct invite link. View joined players and kick troublesome entrants. The "Start Game" button is activated once 2 or more players join.
3. **Join Screen:** Join tables easily by typing the 4-digit room code and your preferred slang name.
4. **Waiting Lobby (Joiner):** Watch real-time participants populate with colored initial avatars while waiting for the host to commence.
5. **Prompt Screen:** Complete funny prompts under a 20-second ticking clock. Submissions lock once you hit submit or the timer hits 0.
6. **Voting Screen:** View other players' submissions completely anonymously. Self-voting is physically locked out. Cast your vote before the 15-second timer expires!
7. **Round Results Screen:** True identities are revealed side-by-side with earned roasts. High-contrast award tags showcase speed multipliers and vote champions alongside updated ranks.
8. **Final Leaderboard:** Ranked final scores. The ultimate winner is crowned with floating visual canvas-confetti, a copyable share summary button, and a play-again trigger for another round.

---

## 💻 Running Locally

To run Snap Roast on your local computer, follow these simple steps:

1. **Ensure Node.js is installed** (v18 or higher is recommended).
2. **Download or clone the files** into a workspace folder.
3. **Open Terminal** in that directory and run:

```bash
npm install
```

4. **Start the local server:**

```bash
npm run dev
```

5. **Open your browser** at [http://localhost:3000](http://localhost:3000) and invite other devices on the same local network!

---

## ☁️ Deployments

Snap Roast is completely self-contained, using Express serving static vanilla frontend assets with Socket.io managing network frames. There are no databases or secondary servers needed.

### 1. Deploying to Railway (Free Tier)
1. Sign up/Log in on [Railway.app](https://railway.app/).
2. Create a new project and select **Deploy from GitHub repo** (or upload via CLI).
3. Railway automatically detects `package.json` and runs the `start` script.
4. Add a custom domain or use Railway's generated URL.
5. *Note:* Make sure `PORT` defaults to `3000` or whatever Railway injects into environment variables (the server automatically binds!).

### 2. Deploying to Render (Free Tier)
1. Sign up/Log in on [Render.com](https://render.com/).
2. Create a new **Web Service**.
3. Link your GitHub repository.
4. Set the following parameters:
   * **Runtime:** `Node`
   * **Build Command:** `npm run build`
   * **Start Command:** `npm run start`
5. Select the **Free Instance Type** and click Deploy.

---

## 🎯 Prompts Used (55 Total)

Below is the complete, family-friendly, high-energy list of all 55 prompts randomly chosen without repetition:

1. "Name something you'd find in a grandma's purse"
2. "The worst thing to say on a first date"
3. "A terrible superpower nobody asked for"
4. "What's in Area 51 (be honest)"
5. "The worst pizza topping ever invented"
6. "Something you'd whisper to a cactus"
7. "A job title that shouldn't exist but does"
8. "The most suspicious thing to Google"
9. "What do cats actually think about"
10. "A terrible name for a baby"
11. "The most embarrassing ringtone to have go off in a quiet library"
12. "A weird thing to keep in your refrigerator"
13. "The warning label that should be on every human"
14. "What you would trade your soul for on a hot summer day"
15. "A lesson you learned the hard way"
16. "A highly unusual candidate to be the next president"
17. "The absolute worst thing to use as a bookmark"
18. "A terrible theme for a high school prom"
19. "The first thing you would do if you became invisible"
20. "Something you shouldn't do while riding a unicycle"
21. "The weirdest excuse for being late to work"
22. "A terrible name for a pet alligator"
23. "What plants are saying when you water them"
24. "Something you shouldn't clean with an electric toothbrush"
25. "The most awkward thing to say after a sneeze"
26. "The primary ingredient in a wizard's budget potion"
27. "A terrible slogan for an airline"
28. "What the monsters under your bed are actually doing all night"
29. "A suspicious sound to hear coming from the kitchen at 3 AM"
30. "The worst gift to bring to a housewarming party"
31. "A name for a new planet that sounds highly unappealing"
32. "The real replacement for money in a post-apocalypse"
33. "A terrible sport to play in a tuxedo"
34. "What squirrels are plotting when they stare at you"
35. "Something you shouldn't say to an officer while getting a ticket"
36. "The worst possible thing to hear your dentist whisper"
37. "A creative use for left-over mashed potatoes"
38. "A hilarious law that should definitely be enacted"
39. "A suspicious instruction on a box of microwave dinners"
40. "The worst thing to find inside a pinata"
41. "What historical figure would have had the worst social media feed"
42. "A funny excuse for why you didn't do your homework"
43. "The real reason the dinosaurs went extinct"
44. "What you shouldn't say to a flight attendant"
45. "A terrible idea for a mascot of a healthy cereal"
46. "Something that always sounds like a lie even when it is true"
47. "The most useless item to bring on a safari"
48. "A terrible name for a discount cruise ship"
49. "What really happens when you pull a funny face and the wind changes"
50. "The worst song to walk down the aisle to at a wedding"
51. "Something you should never say to a barber"
52. "A bad idea for a scratch-and-sniff sticker scent"
53. "The worst item to use as a defensive weapon"
54. "Something you shouldn't ask a palm reader"
55. "The real reason cats hate water"
