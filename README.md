# 🎓 EduAgent — AI-Powered Academic Workspace

> An all-in-one academic planner, study coach, and productivity assistant designed for university students and lifelong learners.

[![React](https://img.shields.io/badge/React-19.2-blue.svg)](https://react.dev/)
[![TanStack Start](https://img.shields.io/badge/TanStack_Start-v1-orange.svg)](https://tanstack.com/start)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC.svg)](https://tailwindcss.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Overview

**EduAgent** replaces fragmented student tools (Notion, Google Calendar, Pomodoro apps, and Quizlet) by bringing task management, daily routine scheduling, project breakdown, flashcards/quizzes, and an AI study coach together into a single, unified workspace.

---

## ✨ Features

- 📊 **Smart Dashboard:** Real-time metrics tracking pending deadlines, weekly study hours, course progress, and upcoming exams.
- ✅ **Task Management:** Group tasks by course, priority (High, Medium, Low), and status (To Do, In Progress, Done) with estimated durations.
- ⏰ **Daily Routine & Schedule:** Visual time-blocking for lectures, study blocks, and personal routines with day-of-week filters and "Now" tracking.
- 🎯 **Project-Based Learning (PBL):** Manage multi-phase academic projects with milestone timelines and **One-Click AI Milestone Breakdown**.
- 📅 **Unified Calendar & Reminders:** Centralized view of assignment due dates, daily routines, and timed desktop reminder alerts.
- ⏱️ **Full-Screen Focus Mode:** Distraction-free Pomodoro timer (25/5, 50/10, or deep work presets) with a built-in distraction tally counter.
- 🤖 **AI Study Coach:** On-demand concept tutor and assignment planner powered by OpenAI / Lovable AI Gateway with academic-integrity guardrails.
- 🗂️ **Smart Flashcards & Quizzes:** Instant generation of active-recall decks and multiple-choice practice quizzes from course notes or topics.
- 📈 **Study Analytics:** Interactive visual charts powered by Recharts comparing planned vs. actual study sessions.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Tailwind CSS v4, Radix UI Primitives, Lucide Icons |
| **Routing & SSR** | TanStack Router & TanStack Start v1 (Full-stack file-based routing) |
| **Data Fetching** | TanStack Query v5 |
| **Database & Auth** | PostgreSQL (Lovable Cloud) with Row-Level Security (RLS) & Social OAuth |
| **AI Integration** | Lovable AI Gateway (`gpt-6-astra`) with local OpenAI API fallback (`gpt-4o-mini`) |
| **Data Visualization**| Recharts & date-fns |
| **Tooling & Tests** | Vite, Bun, Vitest, Testing Library, ESLint, Prettier |

---

## 📁 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── edu/
│   │   │   ├── Workspace.tsx       # Main workspace shell, dashboard, tasks, PBL, and coach
│   │   │   ├── NewViews.tsx        # Daily schedule, reminders, and focus mode
│   │   │   └── StudyView.tsx       # Smart flashcards and practice quizzes
│   │   └── ui/                     # Accessible Radix UI components & buttons
│   ├── lib/
│   │   ├── ai.functions.ts         # Server functions for AI coach and study generators
│   │   ├── edu-store.ts            # State store, cloud sync, and seed data
│   │   └── utils.ts                # Class merging & format helpers
│   ├── routes/
│   │   ├── __root.tsx              # Root HTML shell & global providers
│   │   ├── index.tsx               # Public landing page
│   │   ├── auth.tsx                # Sign In / Sign Up with Email & Google
│   │   └── _authenticated/app/     # Protected student workspace routes
│   └── styles.css                  # Global design tokens and Tailwind v4 setup
├── public/                         # Static assets and favicons
├── vitest.config.ts                # Test runner configuration
└── package.json                    # Dependencies and scripts

