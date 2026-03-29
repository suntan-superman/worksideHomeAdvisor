# Seller Marketing Dashboard UX Spec
(Condensed Codex-Ready Version)

## Overview
Central dashboard for reviewing, editing, approving, and exporting listing marketing across MLS, Google, Social, Email, SMS, and Landing Pages.

---

## Layout

Top Nav:
- Address, status, actions (Generate, Approve All, Export)

3-Panel Layout:
- Left: Listing summary + media + warnings
- Center: Channel tabs + content editor
- Right: Actions + approvals + export

Bottom:
- Version history + compare

---

## Channels (Tabs)

- MLS
- Google
- Social
- Email
- SMS
- Landing Page
- PDF

Each tab includes:
- Status badge
- Editable content
- Variant selector
- Approve / regenerate

---

## Core Actions

Per Channel:
- Edit
- Copy
- Regenerate
- Approve

Global:
- Approve All
- Export Bundle
- Regenerate All

---

## States

- Not Generated
- Generated
- Needs Review
- Approved
- Locked

---

## Warnings

- Missing MLS data
- Compliance issues
- Weak descriptions

---

## Export

- Download per channel
- Download full bundle (ZIP)

---

## Versioning

- Timeline of changes
- Compare versions
- Restore previous

---

## Components (React)

- Dashboard
- ChannelTabs
- ContentEditor
- ApprovalPanel
- WarningPanel
- ExportPanel
- VersionTimeline

---

## APIs

GET /dashboard  
POST /generate  
POST /approve  
POST /export  

---

## Goal

Fast, clean review + approval workflow so listings can go live quickly with high-quality marketing.
