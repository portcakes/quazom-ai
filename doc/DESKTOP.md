# Quazom Desktop App Requirements

**Document type:** AI-friendly product requirements and implementation reference  
**Product:** Quazom Desktop App  
**Target platforms:** macOS, Windows, Linux  
**Desktop framework:** Electron using the Webpack + TypeScript template  
**Related apps:** Quazom web app, future iPad/tablet app, future iPhone/Android app  
**Primary goal:** Bring Quazom’s existing web learning platform into a focused desktop learning environment with browser-like study tabs, local desktop affordances, and a more immersive “personal university” workspace.

---

## 1. Product Summary

The Quazom Desktop App should be a cross-platform Electron application that wraps and extends the existing Quazom product into a dedicated desktop learning environment.

The desktop app should preserve the core Quazom web experience:

- curriculum generation
- lesson generation
- study scheduling
- markdown/rich note-taking
- annotations
- progression tracking
- module graduation
- resource uploads
- Continuity Notes
- note import/export
- TTS generation and audio playback

The desktop app should also introduce desktop-native and browser-like workflows:

- tabbed study workspace
- curriculum tabs
- lesson tabs
- homework tabs
- assessment tabs
- discussion tabs
- resource/PDF tabs
- web browsing tabs
- tab groups
- side-by-side Continuity Notes editor
- ambient study utilities
- pomodoro/timer tools
- picture-in-picture media support where possible
- deeper research and source-gathering workflows

The desktop app should feel less like “the website in a wrapper” and more like a dedicated learning/research operating environment.

---

## 2. Core Product Philosophy

Quazom is an AI-powered platform for self-directed learning, interdisciplinary research, and long-term intellectual growth.

The desktop app should reinforce Quazom’s core mission:

- help users structure self-directed learning
- make independent study feel guided and coherent
- support long-term intellectual continuity
- encourage active learning instead of passive AI consumption
- help users archive and revisit their thinking
- support interdisciplinary research and personal knowledge-building

The desktop app should not become a bloated productivity suite. Utility features should support studying, research, continuity, and focus.

---

## 3. Current Quazom Stack Context

The existing main web app uses:

- **Framework:** Next.js 16 / React 19
- **Language:** TypeScript
- **Styling:** Tailwind CSS, shadcn-style UI components, Radix/Base UI-style primitives
- **API/data layer:** tRPC, TanStack Query
- **AI:** Vercel AI SDK / AI SDK with Google provider
- **Auth:** Better Auth
- **Payments:** Polar
- **Background jobs:** Inngest
- **Database:** Neon Postgres
- **ORM:** Prisma
- **Object storage:** Cloudflare R2
- **Email package:** internal `@quazom-ai/emails`
- **Shared UI package:** internal `@quazom-ai/ui`
- **Shared DB package:** internal `@quazom-ai/db`
- **Analytics/observability:** Vercel Analytics, Speed Insights, Sentry
- **Resources/PDF tooling:** R2, `unpdf`, `@mozilla/readability`, `linkedom`
- **Editor/note tooling:** TipTap extensions, Markdown support, annotations/highlighting
- **Audio/TTS:** existing Quazom audio generation and audio library concepts

The Electron app should reuse as much web app code as possible through shared packages, shared API contracts, and shared UI patterns.

---

## 4. Recommended Desktop Architecture

### 4.1 High-Level Shape

Use Electron as the desktop shell and keep most product functionality inside a React/TypeScript renderer app.

Recommended architecture:

```txt
/apps
  /main
    Existing Quazom web app
  /desktop
    Electron desktop app
/packages
  /db
    Prisma schema and generated client
  /ui
    Shared UI components
  /emails
    Shared email templates
  /shared
    Optional shared types, utilities, constants, API schemas
```

The desktop app should be treated as its own app, not as a fork of the web app.

### 4.2 Electron Process Split

Use a standard Electron separation:

```txt
desktop/
  src/
    main/
      main.ts
      window-manager.ts
      app-menu.ts
      deep-links.ts
      auto-updater.ts
      safe-storage.ts
    preload/
      preload.ts
    renderer/
      main.tsx
      App.tsx
      routes/
      components/
      features/
```

Responsibilities:

| Layer | Responsibility |
|---|---|
| Main process | app lifecycle, windows, menus, native dialogs, downloads, file system access, protocol/deep links, secure storage, update flow |
| Preload script | safe, typed bridge between Electron and renderer |
| Renderer | React UI, tabs, study workspace, API calls, note editor, resource viewer, learning workflows |

### 4.3 Security Requirements

Electron must be configured defensively from the beginning.

Required defaults:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` where possible
- no direct Node APIs in renderer
- expose only narrow APIs through `contextBridge`
- validate all IPC inputs with Zod or equivalent
- restrict external navigation
- open unknown external links in the user’s default browser unless explicitly opened in a Quazom Web tab
- block unsafe protocols
- use a strict Content Security Policy
- never expose API keys, database credentials, Polar secrets, Better Auth secrets, or R2 secrets in the renderer

### 4.4 Desktop App API Strategy

The desktop app should not connect directly to Neon Postgres from the client.

Preferred approach:

- Desktop app calls the existing Quazom backend/API.
- Auth remains server-backed through Better Auth.
- AI generation continues to happen server-side.
- Inngest jobs remain server-side.
- R2 uploads use presigned URLs or existing upload API routes.
- Polar checkout/customer portal flows use hosted browser windows or external browser handoff.

Avoid putting Prisma, Neon connection strings, R2 secrets, AI provider keys, Polar secrets, or Inngest signing keys inside the Electron app.

---

## 5. Authentication Requirements

### 5.1 Login

The desktop app should support login with the existing Quazom account system.

Preferred options:

1. Open a secure auth flow in an external browser, then return to the desktop app using a deep link.
2. Use an Electron `BrowserWindow` or `BrowserView` for auth only if cookies/session handling can be kept secure and predictable.
3. Store only session tokens or safe auth state using Electron-safe storage.

### 5.2 Session Handling

Requirements:

- user should remain logged in across app restarts
- user should be able to log out cleanly
- expired sessions should redirect to login
- auth state should sync with the existing web account
- account deletion and privacy controls should remain consistent with the web app

### 5.3 Desktop Conflict/Risk Notes

Potential conflict:

- Better Auth may work smoothly in a normal browser environment but may require careful handling in Electron due to cookie storage, redirect URLs, and deep linking.

Implementation note:

- Plan a dedicated auth spike before building too many desktop-only features.

---

## 6. Payment Requirements

Payments should continue to use Polar.

Requirements:

- desktop users can view current subscription status
- desktop users can upgrade, downgrade, or manage billing
- checkout/customer portal should open in the system browser unless an embedded flow is proven safe
- the app should detect subscription status after checkout completion
- subscription limits should match the web app

Potential conflict:

- Embedded payment flows inside Electron can create trust, compliance, and redirect issues.

Recommended decision:

- Use external browser checkout and return to app/web dashboard after payment.

---

## 7. Desktop Workspace Requirements

### 7.1 Main Layout

The desktop app should use a study-workspace layout:

```txt
┌─────────────────────────────────────────────────────────────┐
│ App menu / title bar / command controls                     │
├───────────────┬─────────────────────────────────────────────┤
│ Sidebar       │ Tab bar                                     │
│               ├─────────────────────────────────────────────┤
│ Curricula     │ Active tab content                          │
│ Notes         │                                             │
│ Resources     │                                             │
│ Audio         │                                             │
│ Search/Web    │                                             │
│ Settings      │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

Optional:

```txt
┌─────────────────────────────────────────────────────────────┐
│ Active content                                  Continuity  │
│                                                 side editor │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Tab System

Users should be able to open multiple types of tabs:

- Curriculum tabs
- Lesson tabs
- Homework tabs
- Assessment tabs
- Discussion tabs
- Resource tabs
- PDF tabs
- Web tabs
- Continuity Note tabs
- Report Card tabs
- Audio Library tabs
- Settings tabs

Each tab should have:

- title
- icon
- type
- optional linked entity ID
- dirty/unsaved state if applicable
- close button
- duplicate/open-in-new-window option if practical
- restore-on-restart behavior if feasible

### 7.3 Tab Groups

Users should be able to:

- create tab groups
- name tab groups
- assign icon/emoji
- assign color
- move tabs into groups
- collapse/expand groups
- reopen recent groups

Examples:

- “Japanese N4”
- “Architecture + Sociology”
- “Homeschooling Research”
- “Quazom YC Research”
- “Roman Empire Reading Week”

### 7.4 Desktop-Specific Tab Persistence

The app should remember:

- open tabs
- active tab
- tab groups
- split editor state
- sidebar collapsed/expanded state
- last opened curriculum/resource/note

Potential local storage options:

- Electron Store
- SQLite local metadata database
- IndexedDB in renderer

Do not store sensitive auth secrets in plain local storage.

---

## 8. Curriculum Features

The desktop app should support all current curriculum behavior from the web app.

Requirements:

- generate curricula based on:
  - subject/topic
  - skill level
  - learning goals
  - areas of interest
  - optional constraints
- view curriculum overview
- view modules and lessons
- track curriculum progress
- track module progress
- view graduation/progression state
- open curriculum in a Curriculum tab
- open lessons from curriculum into Lesson tabs
- generate more advanced continuations in the future
- support shareable/importable curricula in the future

### 8.1 Content Type Controls

Users should be able to include or exclude lesson/content types during curriculum generation.

Examples:

- only readings
- no video lessons
- no discussions
- no assessments
- include projects
- include homework
- include quizzes
- include field trip ideas if relevant

This should be implemented as structured generation options rather than relying only on freeform prompt text.

### 8.2 College Catalog Curriculum Import

Future/advanced desktop feature:

Users should be able to generate curricula based on a specific college or university course catalog.

Possible flows:

1. User opens a university catalog in a Web tab.
2. User selects/imports relevant courses.
3. App extracts course titles/descriptions.
4. User chooses scope and goal.
5. Quazom generates a personal curriculum inspired by the catalog.

Important limitation:

- Course catalogs vary heavily in structure.
- Some catalogs block scraping.
- Some pages may require JavaScript rendering.
- Copyright and attribution should be handled carefully.
- The app should not imply official affiliation with any university.

Implementation recommendation:

- Start with user-pasted catalog links/text.
- Later support assisted extraction from open catalog pages.
- Store source URLs and extracted metadata.

---

## 9. Lesson Features

The desktop app should support existing lesson generation and viewing.

Lesson types:

- Reading
- Video [Retiring as of May 2026]
- Quiz (Assessment)
- Exercise (Assessment)
- Project
- Discussion
- Homework

Requirements:

- open each lesson in a Lesson tab
- generate lesson content on demand
- regenerate/refine lesson content where allowed
- annotate lesson content
- highlight lesson content
- link lesson content to Continuity Notes
- generate TTS audio from lesson content
- open related resources/searches in Web or Resource tabs
- mark lesson as complete
- update module/curriculum progress

### 9.1 Video Lessons

If video lessons remain part of Quazom:

Requirements:

- display suggested video search links or embedded supported video content
- allow transcript-based learning where possible
- allow users to save transcripts as resources/notes where legally and technically possible
- support picture-in-picture where the OS/browser engine allows it

Potential conflict:

- YouTube embedding and transcript extraction have policy and technical limitations.
- Not every video has available transcripts.
- YouTube pages may not work well inside custom Electron webviews without careful handling.

Recommended MVP decision:

- Treat video lessons as “guided video research” with links/searches first.
- Add transcript import/generation later.

---

## 10. Homework Features

Homework should be attached to reading/video/project lessons where appropriate.

Requirements:

- homework opens in a Homework tab
- homework can include:
  - essay prompts
  - short-answer prompts
  - creative exercises
  - build/practice tasks
  - reflection tasks
  - research tasks
- user can save draft work
- user can submit homework for AI feedback
- feedback is stored with the lesson/module
- homework feedback can contribute to Report Card summaries
- homework output can optionally be linked to Continuity Notes

Implementation note:

- Homework should be modeled separately from quizzes/exercises because it may involve long-form writing and rubric-style feedback.

---

## 11. Assessment Features

Assessments include quizzes and exercises.

Requirements:

- assessments open in Assessment tabs
- support open-book mode
- support distraction-free mode
- support auto-save
- support submission and grading
- show results and explanations
- store assessment attempts
- feed results into progress tracking
- feed results into Report Card
- optionally influence future adaptive curricula

### 11.1 Distraction-Free Mode

Desktop-specific behavior:

- hide sidebar
- hide unrelated tabs
- optionally enter fullscreen
- show only assessment content and minimal controls
- user can exit intentionally

Potential conflict:

- Full lockdown testing behavior is not recommended for the MVP.
- Electron can create focused windows but should not attempt invasive proctoring.

Recommended decision:

- Build “distraction-free,” not “locked-down.”

---

## 12. Discussion Features

Discussion lessons should support constrained AI tutor conversations.

Requirements:

- discussion opens in a Discussion tab
- conversation is tied to a lesson/curriculum
- user receives AI responses within a limited educational context
- support turn limits if needed for cost control
- store transcript
- allow user to convert useful discussion moments into notes
- allow user to link discussion transcript excerpts to Continuity Notes

Cost-control requirements:

- enforce subscription/generation limits
- avoid unbounded chat loops
- keep system prompts focused and compact
- stream responses where practical

---

## 13. Continuity Notes Requirements

Continuity Notes are a major desktop feature and should be treated as a first-class workspace.

Requirements:

- create Continuity Notes
- edit Continuity Notes in rich text/Markdown-compatible format
- tag notes
- link notes to:
  - curricula
  - modules
  - lessons
  - resources
  - annotations
  - quotes
  - assessment results
  - homework
  - discussions
- open note in a dedicated tab
- open note in a side editor
- position side editor on left or right
- collapse/expand side editor
- preserve editor state across sessions
- support import/export as MD, TXT, and PDF where possible

### 13.1 Side Editor

Desktop-specific requirement:

Users should be able to keep a Continuity Note open beside any active learning material.

Example workflows:

- read a lesson while adding notes to a thesis
- browse an article while pulling quotes into a note
- review assessment feedback while revising a research question
- compare multiple curricula while building a Continuity Note

### 13.2 Quote and Annotation Capture

Users should be able to:

- highlight text in lessons/resources
- send highlighted text to a Continuity Note
- preserve source metadata
- preserve source URL or resource ID
- preserve lesson/curriculum context
- optionally include citation-style metadata

Potential conflict:

- Capturing selections from arbitrary Web tabs may be more complex than capturing text from Quazom-controlled content.
- Cross-origin web content may restrict direct DOM access depending on implementation.

Recommended decision:

- MVP: capture quotes from Quazom lessons/resources/PDFs.
- Later: support “send selection to Quazom” from Web tabs where technically safe.

---

## 14. Continuity Curricula Requirements

Continuity Curricula are future-facing but should be planned into the desktop architecture.

Definition:

A Continuity Curriculum starts from a user’s thesis, notes, annotations, quotes, and prior learning history. It generates one module at a time and evolves based on the user’s work.

Requirements:

- user selects one or more Continuity Notes
- user defines or confirms a thesis/research direction
- app generates the first module only
- user completes lessons/homework/assessments
- app uses completed work and feedback to generate the next module
- curriculum evolves over time
- preserve reasoning/source context for future modules

Important principle:

Continuity Curricula should support discovery, not force a rigid pre-generated path.

Implementation note:

- Design the data model so curricula can be generated incrementally module-by-module.

---

## 15. Continuity Timeline Requirements

Continuity Timelines are future-facing but should influence architecture.

Users should eventually be able to see a timeline of:

- subjects studied
- curricula started/completed
- notes created
- annotations added
- major themes
- research questions
- assessment/homework milestones
- concept growth over time

Requirements:

- timeline should be generated from existing user activity
- user should control visibility
- private by default
- useful for personal reflection and optional sharing

Potential future use:

- shareable intellectual portfolio
- public learning profile
- research archive
- “personal university transcript”

---

## 16. Resource and PDF Features

The desktop app should support Quazom’s existing resource upload and study workflows.

Requirements:

- upload PDFs, articles, papers, and other study resources
- store files in Cloudflare R2 through server-side/presigned upload flows
- open saved PDFs in Resource tabs
- annotate resources
- extract text where possible
- generate summaries where allowed
- create quotes from resources
- link resources to notes/curricula/lessons
- generate TTS audio from supported resource text
- import/export notes and archives

### 16.1 Desktop File Handling

Desktop-specific requirements:

- drag-and-drop file upload
- native file picker
- “Open with Quazom” support eventually
- download/export to local disk
- reveal exported file in Finder/Explorer
- preserve upload progress indicators
- warn before uploading very large files

Potential conflict:

- Large PDF parsing should not block the renderer process.
- Heavy parsing should happen server-side or in a worker.

Recommended decision:

- Use existing backend processing for AI/resource parsing.
- Use local preview where simple, but avoid heavy local-only parsing for MVP.

---

## 17. Web Browsing Features

The desktop app should include a controlled Web tab feature for research browsing.

Requirements:

- user can start a new Web browsing session
- web searches from lessons can open in Web tabs
- external resources can open in Web tabs
- user can save links into Quazom
- user can import sources from links where supported
- user can capture page metadata
- user can route selected/saved sources into notes/curricula

### 17.1 Browser Implementation Options

Electron options:

1. `WebContentsView`
2. `<webview>` tag
3. normal renderer iframe/browser-like implementation
4. external default browser only

Recommended for MVP:

- Start with simple link saving and external browser open.
- Add internal Web tabs after a focused technical spike.

Reason:

- Building a safe browser inside Electron is non-trivial.
- Web tabs require careful security isolation, navigation controls, permissions handling, and content capture boundaries.

### 17.2 Web Tab Controls

If implemented, Web tabs should include:

- URL bar
- back/forward
- reload
- stop loading
- open externally
- save link
- import as resource
- send selected quote to note where possible
- tab title/favicon
- basic permission prompts

### 17.3 Web Security Requirements

For arbitrary web content:

- isolate web content from the main Quazom renderer
- do not inject privileged APIs into arbitrary pages
- disable Node integration
- restrict preload exposure
- handle downloads safely
- block or confirm suspicious protocols
- open payment/auth-sensitive external sites in the system browser unless explicitly needed

Potential conflict:

- A full Chromium-like browser experience is possible in Electron but increases security and complexity.
- Treat Web tabs as a research aid, not as a general-purpose Chrome replacement.

---

## 18. Maps and Field Trip Features

Future feature:

Users can generate “Field Trip” itineraries based on:

- curricula
- current lessons
- Continuity Notes
- research interests
- location preferences

Requirements:

- generate itinerary suggestions
- show location list
- optionally show map view
- open map in Google Maps or embedded map provider
- allow user to save itinerary as a resource/note
- allow user to export itinerary

Potential conflict:

- Embedded Google Maps may require API keys, billing, and compliance with Google Maps Platform terms.
- Location-based features raise privacy considerations.

Recommended decision:

- Start by generating textual itineraries with external map links.
- Add embedded maps later only if clearly useful.

---

## 19. Report Card Requirements

The Report Card should summarize learning performance and progress.

Inputs:

- completed lessons
- quiz/exercise results
- homework feedback
- project feedback
- discussion participation
- module graduation state
- curriculum progress
- weak/strong concepts
- user reflections

Requirements:

- Report Card opens in a dedicated tab
- show progress by curriculum/module
- show strengths
- show areas to revisit
- show suggested next steps
- optionally generate a narrative academic review
- optionally export as PDF/Markdown

Important:

- The Report Card should feel encouraging and academic, not punitive.
- It should support self-directed growth rather than ranking the user harshly.

---

## 20. TTS and Audio Library Requirements

The desktop app should support Quazom’s TTS/audio functionality.

Requirements:

- generate TTS audio from lessons
- generate TTS audio from notes
- generate TTS audio from resources where text extraction is available
- save audio to user’s audio library
- play audio in-app
- organize academic playlists
- continue playback while navigating tabs
- show mini-player controls
- optionally support OS media keys

### 20.1 Academic Playlists

Users should be able to create playlists such as:

- “Japanese Listening”
- “Architecture Readings”
- “Sociology Notes”
- “Review Before Assessment”
- “Research Audio Queue”

Potential conflict:

- Background playback and media key support differ across platforms.
- Offline audio caching raises storage and rights questions.

Recommended MVP decision:

- Stream or play stored generated audio from the Quazom backend/R2.
- Add offline caching later.

---

## 21. Study Utilities

Desktop utilities should support focus and learning.

### 21.1 Timers

Users should be able to:

- start a Pomodoro timer
- set custom study duration
- set an “I want to study until [time]” timer
- create alarms/reminders
- optionally link timer sessions to curricula/lessons
- record study session metadata

Timer examples:

- 25/5 Pomodoro
- 50/10 deep work
- study until 10:30 PM
- review for 15 minutes
- free study stopwatch

### 21.2 Ambient Soundscapes

Users may eventually customize ambient study sound.

Requirements:

- provide optional soundscapes
- allow volume control independent from TTS/audio
- allow user to disable entirely
- do not autoplay unexpectedly

Potential conflict:

- Bundled audio assets increase app size.
- Streaming soundscapes may require licensing.

Recommended MVP decision:

- Start with timer only.
- Add soundscapes after legal/source decisions.

### 21.3 Music/Podcast Integrations

Desired integrations:

- Spotify
- Apple Music
- YouTube
- podcasts

Potential conflicts:

- Spotify playback requires API constraints and may require Premium for full playback.
- Apple Music requires MusicKit and Apple developer configuration.
- YouTube embedding/playback has policy constraints.
- Electron apps may not be allowed to behave like general media-ripping/transcript-extraction tools.

Recommended MVP decision:

- Use external links or embeddable widgets where allowed.
- Do not make streaming integration core to the MVP.

---

## 22. Theme and Personalization Requirements

Users should be able to customize the desktop app experience.

Requirements:

- light/dark/system theme
- Quazom default “paper and coffee” aesthetic
- custom accent colors
- optional background themes
- font preferences where practical
- tab group colors
- app density settings eventually

Constraints:

- personalization should not break readability
- all themes should preserve accessibility
- custom fonts may increase packaging complexity if bundled

---

## 23. Sharing and Public Profile Requirements

Future feature:

Users can create a shareable page that showcases:

- public Continuity Timeline
- public curricula
- public notes
- short profile blurb
- theme matching their app preferences

Requirements:

- private by default
- user explicitly chooses what to publish
- public pages are web-hosted, not desktop-only
- desktop app can manage public sharing settings
- imported curricula should create a base copy, not mutate the original

Potential conflict:

- Public sharing requires moderation/reporting/privacy controls.
- Notes may contain sensitive personal information.

Recommended decision:

- Build sharing later after private learning workflows are strong.

---

## 24. Offline and Local-First Considerations

The desktop app does not need to be fully offline-first for MVP.

Recommended MVP behavior:

- app requires internet for login, AI generation, sync, payments, and most data
- allow cached viewing of recently opened content where easy
- preserve unsaved local note drafts
- show clear offline/error states
- queue safe local changes only if sync complexity is manageable

Potential future features:

- offline note editing
- offline reading cache
- offline audio cache
- local search index
- local-first personal archive

Potential conflict:

- True offline-first sync with Postgres-backed web app is complex.
- Conflict resolution for notes/resources can become a large project.

Recommended decision:

- MVP: online-first with local draft protection.
- Later: selective offline support.

---

## 25. Notifications

Desktop notification requirements:

- optional study reminders
- timer completion alerts
- background job completion alerts
- lesson/resource generation complete
- TTS generation complete
- scheduled study session reminder

Requirements:

- user can turn notifications on/off
- respect OS notification permissions
- avoid noisy notifications
- do not show sensitive note/lesson content in notifications unless user opts in

---

## 26. Search and Command Palette

The desktop app should eventually include a command palette.

Commands may include:

- open curriculum
- open note
- open resource
- new tab
- new Web tab
- new Continuity Note
- start timer
- generate lesson
- upload resource
- search all notes/resources
- jump to active curriculum
- export current note

Keyboard shortcut:

- macOS: `Cmd+K`
- Windows/Linux: `Ctrl+K`

---

## 27. Data Model Additions to Consider

Desktop-specific or future features may require new tables/models.

Possible additions:

- `desktop_workspace_state`
- `tab_groups`
- `open_tabs`
- `homework_assignments`
- `homework_submissions`
- `assessment_attempts`
- `report_cards`
- `audio_playlists`
- `audio_playlist_items`
- `field_trip_itineraries`
- `continuity_timelines`
- `shared_profiles`
- `shared_curricula`
- `saved_links`
- `study_sessions`

Design notes:

- Keep most canonical data server-side.
- Keep ephemeral workspace state local unless cross-device sync is desired.
- Avoid storing arbitrary web browsing history unless the user explicitly saves links/resources.
- Make privacy defaults conservative.

---

## 28. AI and Background Job Requirements

The desktop app should use the same server-side AI generation system as the web app.

AI generation should support:

- curricula
- lessons
- homework prompts
- homework feedback
- quizzes/exercises
- discussion responses
- TTS generation
- resource summaries
- Continuity Curricula
- Report Cards
- Field Trip suggestions

Background jobs through Inngest should handle:

- long-running generation
- resource parsing
- TTS generation
- large import workflows
- potentially timeline/report generation

Requirements:

- renderer shows generation status
- renderer can poll or subscribe for job completion
- failed jobs show useful recovery options
- user can retry where safe
- subscription limits are enforced server-side

---

## 29. Desktop MVP Scope

The first useful desktop app should focus on a strong dedicated study workspace, not every future vision feature.

### 29.1 Recommended Desktop MVP

Include:

- login/logout
- existing curriculum dashboard
- curriculum tabs
- lesson tabs
- Continuity Note tabs
- Continuity side editor
- resource/PDF tabs for existing uploaded resources
- link saving/import flow
- annotation/quote capture from Quazom-controlled content
- study timer/Pomodoro
- audio library playback for already-supported TTS
- desktop file upload via picker/drag-and-drop
- restore open tabs on restart
- basic settings/theme support
- external browser fallback for complex web/payment/auth flows

### 29.2 Defer From MVP

Defer:

- full internal Chromium browser experience
- Spotify/Apple Music/YouTube integrations
- embedded Google Maps
- public profiles
- shareable timelines
- full offline-first sync
- full catalog scraper
- OS-level “open with Quazom”
- deep media/transcript extraction
- multi-window power user mode
- complex local database search

---

## 30. Known Conflicts, Risks, and Limitations

### 30.1 Electron Browser Complexity

The vision includes browser-like Web tabs. Electron can support this, but building a secure in-app browser is meaningfully more complex than wrapping the web app.

Risk:

- security vulnerabilities
- cross-origin limitations
- broken websites
- permissions complexity
- increased development time

Recommendation:

- Build link saving and external-browser handoff first.
- Add internal Web tabs only after a dedicated spike.

### 30.2 Auth Redirects

Better Auth may need special handling for Electron.

Risk:

- cookies/sessions may behave differently than in the web app
- OAuth redirects may not return cleanly to the app
- deep linking must be configured per OS

Recommendation:

- Build and test auth before investing deeply in desktop-only UI.

### 30.3 Payments in Desktop

Polar checkout should not be deeply embedded until tested.

Risk:

- payment redirects may fail
- embedded checkout can feel less trustworthy
- compliance/user trust concerns

Recommendation:

- use system browser checkout/customer portal.

### 30.4 Secrets in Desktop Apps

Desktop apps are inspectable by users.

Risk:

- any bundled secret can be extracted

Requirement:

- never bundle database credentials, AI keys, R2 secrets, Polar secrets, Inngest secrets, or Better Auth secrets.

### 30.5 Heavy Local Processing

PDF parsing, transcript handling, and resource analysis can be heavy.

Risk:

- frozen renderer
- large memory usage
- inconsistent cross-platform behavior

Recommendation:

- use server-side processing or worker threads.

### 30.6 Mobile/Tablet Divergence

Some desktop features will not translate cleanly to iPad/tablet or phone.

Likely desktop-first features:

- multi-tab research workspace
- side-by-side Continuity editor
- complex Web tabs
- local file management
- multi-window workflows
- OS-level media controls
- large PDF/resource comparison

Plan:

- Treat desktop as the power-user research environment.
- Treat tablet as a focused reading/note-taking/study environment.
- Treat phone as a companion app for review, audio, notes, reminders, and lightweight generation.

---

## 31. Cursor/Claude Implementation Guidance

When using Cursor/Claude to build this app, prefer small vertical slices.

Suggested build order:

1. Create Electron app shell with Webpack + TypeScript.
2. Add secure main/preload/renderer split.
3. Add login/session spike.
4. Render authenticated Quazom dashboard or shared app shell.
5. Add tab model and tab UI.
6. Add Curriculum tab.
7. Add Lesson tab.
8. Add Continuity Note tab.
9. Add Continuity side editor.
10. Add restore-open-tabs local persistence.
11. Add desktop file picker and drag/drop upload.
12. Add Resource/PDF tab.
13. Add Pomodoro/timer utility.
14. Add audio mini-player.
15. Add link saving.
16. Spike internal Web tabs.
17. Add quote capture from Quazom-controlled content.
18. Add Report Card/Homework/Assessment flows.
19. Package and test for macOS.
20. Package and test for Windows.
21. Package and test for Linux if desired.

Cursor should be given one feature slice at a time, with explicit acceptance criteria.

---

## 32. Acceptance Criteria for First Alpha Desktop Build

The first alpha build is successful if:

- user can install and open the desktop app
- user can log into their existing Quazom account
- user can view existing curricula
- user can open a curriculum in a tab
- user can open a lesson in a tab
- user can open/edit a Continuity Note
- user can keep a Continuity Note open beside a lesson
- user can upload a resource through desktop file picker
- user can open a saved PDF/resource
- user can start and complete a Pomodoro/custom timer
- user can play generated audio from the audio library if available
- user can close/reopen the app and recover recent workspace state
- no secrets are bundled in the app
- payments open safely in the external browser
- unknown external links open safely or with confirmation
- app does not crash during normal tab switching/generation workflows

---

## 33. Non-Goals for First Alpha

The first alpha desktop app should not attempt to be:

- a full Chrome replacement
- a full offline-first local-first app
- a proctored testing app
- a full media streaming client
- a public social network
- a full university catalog scraper
- a complete mobile parity implementation

The desktop app should prove the core idea:

> Quazom is more powerful and emotionally resonant when it becomes a dedicated learning workspace instead of only a web dashboard.

---

## 34. Open Questions

These should be answered during implementation planning:

1. Should desktop workspace state sync across devices or stay local?
2. Should Web tabs be included in alpha or deferred until beta?
3. Should the desktop app use the hosted web app inside Electron first, then gradually replace with native renderer routes?
4. How much of the Next.js UI can be extracted into shared React packages?
5. Will Better Auth support the desired Electron flow cleanly?
6. Should resources be cached locally for offline reading?
7. Should TTS audio be cached locally or streamed only?
8. How strict should subscription limits be during desktop alpha?
9. What analytics are appropriate for desktop usage without feeling invasive?
10. What is the minimum lovable version of Continuity Notes on desktop?

---

## 35. Suggested Product Positioning

Internal framing:

> Quazom Desktop is the power-user study and research environment for people building their own university.

User-facing framing options:

- “Your personal university, now as a dedicated desktop workspace.”
- “Study, research, annotate, and build curricula without losing your place.”
- “A focused learning environment for self-directed study.”
- “Turn your curiosity into an organized academic workspace.”

---

## 36. Final Implementation Principle

The desktop app should prioritize:

1. existing Quazom parity
2. study workspace quality
3. Continuity Notes depth
4. resource and quote capture
5. focused utilities
6. safe expansion into browser-like research features

Do not let optional utilities overshadow the core loop:

```txt
Generate curriculum → study lesson/resource → annotate/take notes → assess/apply → continue learning → build long-term continuity
```
