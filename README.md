<p align="center">
  <img src="screenshots/cover.png" alt="PhishShield Simulator" width="720" />
</p>

<h1 align="center">PhishShield Simulator</h1>

<p align="center">
  <a href="#-why-this-exists">Why this exists</a> •
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-ai-generator-gpt-5-nano">AI Generator</a> •
  <a href="#-accessibility--privacy">Accessibility & Privacy</a>
</p>

---

## 🧭 Why this exists
Hi! I’m **Benjamin**. I built this project to help people (especially my community and older adults) practice **spotting phishing emails** in a safe, interactive way. It’s fast, friendly, and privacy‑respecting. If it helps you—or your family—stay safer online, that’s a win.

---

## ✨ Features
- **Interactive email scenarios** — click suspicious elements and get instant explanations
- **3 difficulty levels** — Obvious → Tricky → Spear‑phishing
- **Scoring + local leaderboard** — privacy‑friendly, no accounts
- **Accessibility** — high‑contrast toggle, dyslexia‑friendly spacing, keyboard focus
- **AI Generator (optional)** — create fresh scenarios using **GPT‑5 nano** (via a secure proxy)
- **Certificate** — print a PDF certificate when you finish a session

---

## 🚀 Quick Start
**Live demo:** (add your GitHub Pages link here after publishing)

**Run locally:**
```bash
# Option 1: Python
python3 -m http.server 8080
# then open http://localhost:8080 in your browser

# Option 2: VS Code Live Server
# install the extension, right‑click index.html → "Open with Live Server"
```

**Play:**
1. Open `index.html` in a browser from a local server.
2. (Optional) Check **Use AI generator** to include AI‑generated emails.
3. Click **Start** and look for suspicious links, buttons, sender domains, and attachments.

---

## 🤖 AI Generator (GPT‑5 nano)
I don’t hard‑code any API keys. Instead, the app calls a tiny **Cloudflare Worker** you control. The Worker stores your OpenAI key securely and forwards requests to OpenAI.

---

## ♿ Accessibility & 🔒 Privacy
- **Accessibility:** dyslexia‑friendly spacing, high‑contrast theme, keyboard focus rings.
- **Privacy:** no tracking, no analytics. Scores live in your browser’s `localStorage` on your device.

---

## 🧰 Tech
**HTML/CSS/JS** only. Hosted with GitHub Pages. AI via **OpenAI GPT‑5 nano** through a Cloudflare Worker proxy I own.

---

## 📜 License
MIT — see [LICENSE](LICENSE).
