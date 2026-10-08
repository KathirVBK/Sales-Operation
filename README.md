# Lead-to-Delivery AI Agent

A college-level workshop project demonstrating how AI agents connect Sales and Operations through:
- AI routing (intent classification)
- LLM-based structured extraction
- Deterministic business rules
- Shared state (SQLite)
- Agent workflows
- React frontend & FastAPI backend

## Setup & Running

### Backend (FastAPI + Groq)
1. Add your Groq API key to `backend/.env` (or pass it directly).
2. Install dependencies:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # on Windows: .\venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   ```
3. Run the backend:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend (React + Vite)
1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:5173` in your browser.

## Demo Scenarios to Try in the Chat Interface:

1. **New Lead Qualification**
   > "Hi, I'm Arun from ABC Technologies. We need an inventory management solution. Our budget is around ₹8 lakh and we want to implement it within 30 days."

2. **Incomplete Lead (Clarification)**
   > "We need a database system for ABC Tech."
   *The agent replies asking for budget and timeline. You answer:*
   > "Around 5 lakh within one month"
   *The agent then scores the lead.*

3. **Deal Won (Operations Handoff)**
   > "ABC Technologies has accepted our proposal. Mark the deal as won."

4. **Status Query**
   > "Is ABC Technologies onboarded?"

5. **Task Update**
   > "Move ABC Technologies verify signed contract to done."

## Scoring Rules

The LLM only extracts the facts from the conversation (budget, timeline). A deterministic Python script then calculates the score based on these facts:

| Factor | Condition | Points |
|---|---|---|
| Budget | > ₹5 Lakh | +20 |
| Budget | <= ₹5 Lakh | +10 |
| Timeline | < 30 days | +20 |
| Timeline | >= 30 days | +10 |

**Tier Thresholds:**
- **HIGH:** 35+ points
- **MEDIUM:** 20-34 points
- **LOW:** < 20 points

## Scope & Limitations

What this project deliberately does NOT do:
- **No real email sending:** It simulates handoffs and notifications.
- **No CRM integration:** It uses a local SQLite database for shared state.
- **No authentication/login:** It is designed for demonstration purposes only.

## Edge Cases

- **Duplicate "Deal Won" events:** If a deal is marked won twice, the system updates the status idempotently without creating duplicate tasks.
- **Non-existent Company:** If an operation is requested for a company that does not exist, the agent will inform you that the record could not be found.

## Task Dependencies
The tasks generated upon winning a deal are completely independent and can be completed in any order.
