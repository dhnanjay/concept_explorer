# Concept Explorer 🚀

**Transform linear LLM outputs into interactive, explorable knowledge trees.**

[![Live Demo](https://img.shields.io/badge/demo-online-brightgreen)](https://conceptexplorer.space/)  
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<p align="center">
  <img src="https://github.com/dhnanjay/concept_explorer/blob/0c79d92b25cb81575905ec92940469bce6d7f04d/concept_explorer.gif" alt="Concept Explorer Screenshot" width="800" />
</p>

---

### 👋 Stay in Touch

- **LinkedIn**: [dhananjay on LinkedIn](https://www.linkedin.com/in/dhnanjay)  
- **Twitter**: [@dhnanjay](https://twitter.com/dhnanjay)

---
## 🚩 Table of Contents

1. [Overview](#overview)  
2. [The UX Nightmare of LLMs](#the-ux-nightmare-of-llms)  
3. [Our Solution](#our-solution)  
4. [Key Features](#key-features)  
5. [How It Works](#how-it-works)  
6. [Tech Stack](#tech-stack)  
7. [Getting Started](#getting-started)  
8. [Configuration & Environment Variables](#configuration--environment-variables)  
9. [Usage](#usage)  
10. [Contributing](#contributing)  
11. [License](#license)  

---

## 🌟 Overview

**Concept Explorer** bridges the gap between AI‑generated knowledge and human intuition. Instead of presenting you with a long block of text, this tool builds a **dynamic knowledge tree** around any starting concept and lets you:

- **Visualize** hierarchical relationships  
- **Navigate** by expanding or collapsing branches  
- **Dive deeper** into leaf nodes via on‑demand search  
- **Preserve context** so you never lose your place  

Think of it as an **AI‑powered mind map** paired with a **contextual search panel** — the perfect combination for structured learning and rapid discovery.

---

## 😫 The UX Nightmare of LLMs

Most LLM outputs arrive as a single, linear wall of text:

> “Here are 10 things you should know about Quantum Mechanics: 1.… 2.… 3.…”

Reading and retaining information from that format is overwhelming:

- ❌ You can’t see the big picture  
- ❌ It’s hard to jump back and forth between subtopics  
- ❌ You lose the hierarchy and relationships  

---

## 💡 Our Solution

Concept Explorer transforms your LLM prompt into a **recursive exploration**:

1. **Seed a root concept** (e.g. “Quantum Mechanics”).  
2. **Generate 4–5 related sub‑concepts** via an LLM (Gemini or OpenAI).  
3. **Recursively expand** each leaf node up to your chosen depth.  
4. **Render** the result as an **interactive tree graph** with ECharts.  
5. **Fetch contextual search results** for any leaf node using Tavily.  

This approach turns passive reading into **active, visual exploration**.

---

## ✨ Key Features

- **Interactive Tree Visualization**  
  Smooth, zoomable, pannable graph powered by ECharts.js.  

- **LLM‑Powered Concept Discovery**  
  Choose between Google’s Gemini or OpenAI GPT to generate related nodes.  

- **Configurable Exploration**  
  - Select provider & override model  
  - Set max depth, diversity (temperature), and node delay  
  - Automatic caching of last tree in local storage  

- **Contextual Search Panel**  
  Click any **penultimate** (leaf) node to fetch relevant text snippets & images from Tavily without leaving the app.  

- **Draggable Split‑View**  
  Resize the tree & search panels on the fly for your ideal layout.  

- **Export & Persist**  
  - Download your tree as **JSON**  
  - Export the visualization as **PNG**  
  - Clear cache to restart exploration  

---

## ⚙️ How It Works

1. **User Input**  
   Enter a root concept in the hero input.  

2. **SSE Stream**  
   The backend (FastAPI + SSE) streams updates as the LLM uncovers new nodes.  

3. **Graph Updates**  
   Frontend listens & progressively renders new branches.  

4. **Leaf Node Search**  
   Clicking a leaf triggers a Tavily API call, populating the results panel with rich contextual information.  

5. **Mind‑Map Meets Search**  
   The **tree** provides structure and relationships, while the **search** supplies depth and examples on demand — a true AI‑powered mind map.

---

## 🏗️ Tech Stack

- **Backend**  
  - Python 3.11 · FastAPI · Uvicorn · sse‑starlette · python‑dotenv  
  - Google Generative AI SDK · OpenAI SDK (optional) · Tavily SDK  

- **Frontend**  
  - HTML · Tailwind CSS · Vanilla JS · ECharts.js  

- **Deployment**  
  - Docker · Fly.io  

---

## 🚀 Getting Started

### Prerequisites

- Python 3.8+  
- Node.js & npm (for any future frontend builds)  
- Git  

```bash
# 1. Clone the repo
git clone https://github.com/dhnanjay/concept_explorer.git
cd concept_explorer

# 2. Setup backend
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Configure .env
cp .env.example .env
# Edit .env with your API keys

# 4. Run the server
uvicorn main:app --reload --port 8000

# 5. Visit the frontend
open http://localhost:8000



⸻

🔧 Configuration & Environment Variables

Create a file named backend/.env (not committed to Git) with:

GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_KEY
TAVILY_API_KEY=YOUR_TAVILY_API_KEY
# OPENAI_API_KEY=YOUR_OPENAI_KEY  # Optional for OpenAI provider



⸻

📖 Usage
	1.	Enter a root concept.
	2.	Watch the graph grow in real time.
	3.	Click any leaf node to load curated search results.
	4.	Resize panels or export your work.

⸻

🤝 Contributing

Contributions are welcome! Please:
	1.	Fork this repository
	2.	Create a feature branch
	3.	Open a pull request describing your changes

⸻

📜 License

This project is licensed under the MIT License.
© 2025 Dhananjay Kumar

