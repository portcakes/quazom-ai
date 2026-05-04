# Quazom AI — Product Requirements Document (MVP)

## Version
v1 — Outline-Based Learning System

## Goal
Deliver a usable, low-friction learning system within 4–8 weeks.

---

## 1. Problem Statement

Self-learners struggle with:
- Lack of structure
- Not knowing what to study next
- Difficulty managing multiple subjects
- No cohesive system for planning and tracking learning

Existing tools are either:
- Too manual (Notion, spreadsheets)
- Too rigid (online courses)
- Too narrow (Duolingo)

---

## 2. Solution

Quazom provides a dynamically generated curriculum and daily study plan across subjects.

Users input a topic → Quazom generates:
- A structured curriculum
- Learning materials
- Practice quizzes
- A personalized study schedule

---

## 3. Core Features (MVP Scope)

### 3.1 Curriculum System (Core Feature)

**Description:**  
Primary interface for learning content

**Requirements:**
- Create a course from user input
- Generate sections/modules
- Generate lessons within sections
- Display as collapsible outline
- Track lesson completion

**User Actions:**
- Create course
- Click lesson
- Mark lesson complete

---

### 3.2 Educator Context (Customization Layer)

**Description:**  
Allows users to guide curriculum generation

**Requirements:**
- Text input for preferences
- Regeneration option
- Override content direction

---

### 3.3 Course Materials Page

**Description:**  
Centralized resource hub per course

**Requirements:**
- AI-generated:
  - Articles
  - Videos
  - References
- Linked to lessons

---

### 3.4 Knowledge Checks (Quizzes)

**Description:**  
Reinforce learning through simple assessments

**Requirements:**
- Generate quiz per lesson or section
- Multiple choice format (MVP)
- Immediate feedback
- No gating logic (yet)

---

### 3.5 Study Scheduling (Primary Differentiator)

**Description:**  
Automatically assigns study tasks across courses

**Requirements:**
- User defines study windows (e.g., Mon 6–8pm)
- System assigns:
  - Lessons
  - Quizzes
- Generates daily plan

---

### 3.6 Dashboard (“Today’s Study Plan”)

**Description:**  
Main entry point for users

**Requirements:**
- Show:
  - Tasks for today
  - Time blocks
  - Course breakdown
- Mark tasks complete

---

## 4. Non-Goals (Out of Scope for MVP)

- Milestone exams (Expeditions)
- Unlock/gating system
- Interdisciplinary linking (Exchanges)
- Node/graph view
- Social features (groups, cohorts)
- Advanced analytics

---

## 5. UX Principles

1. Familiar over novel (LMS-style UI)
2. Action-oriented (“What should I do next?”)
3. Low cognitive load
4. Progress-driven

---

## 6. User Flow (MVP)

1. User creates a course  
2. Quazom generates curriculum  
3. User sets study availability  
4. System generates study plan  
5. User follows daily tasks:
   - Lesson → Materials → Quiz  
6. Progress updates continuously  

---

## 7. Future Expansion

### Phase 2
- Milestones (Expeditions)
- Unlockable progression
- Advanced assessments

### Phase 3
- Interdisciplinary connections (Exchanges)
- Curriculum merging

### Phase 4
- Node-based knowledge map (advanced mode)

### Phase 5
- Social learning (groups, cohorts, fellowships)

---

## 8. Success Metrics

- Lesson completion rate
- Daily active usage
- Courses created per user
- Quiz completion rate

---

## 9. Key Insight

Quazom is not just:
> “an AI curriculum generator”

It is:
> **“a system that tells you what to study every day.”**