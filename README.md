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
   > "We need an inventory system for our company."
   *Wait for agent to ask for budget/timeline, then reply with:*
   > "Around 5 lakh within one month"

3. **Deal Won (Operations Handoff)**
   > "ABC Technologies has accepted our proposal. Mark the deal as won."

4. **Status Query**
   > "Is ABC Technologies onboarded?"

5. **Task Update**
   > "Move ABC Technologies verify contract to done."
