# Workside Home Advisor — UI Component System (Codex-Ready)

## Objective
Provide production-ready UI component structure (React + Tailwind) for:
- Seller Report (PDF + Web)
- Flyer / Marketing Report

Design goals:
- Clean, professional, enterprise-calm
- Fast scanning (10-second understanding)
- Strong hierarchy
- Action-oriented layout

---

# 🧱 DESIGN TOKENS

```ts
export const colors = {
  primary: "#1F3A5F",
  accent: "#E8B48A",
  success: "#4CAF50",
  warning: "#F59E0B",
  danger: "#EF4444",
  neutral: "#F5F5F5",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B7280"
}

export const spacing = {
  xs: "p-2",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8"
}

export const radius = "rounded-2xl"
export const shadow = "shadow-md"
```

---

# 📊 READINESS DASHBOARD COMPONENT

```tsx
export function ReadinessDashboard({ data }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <MetricCard title="Readiness" value="37/100" status="danger" />
      <MetricCard title="Photo Quality" value="6/100" status="warning" />
      <MetricCard title="Checklist" value="30%" status="warning" />
      <MetricCard title="Launch Status" value="Needs Work" status="danger" />
    </div>
  )
}
```

---

# 🧾 METRIC CARD

```tsx
export function MetricCard({ title, value, status }) {
  const colorMap = {
    success: "text-green-600",
    warning: "text-yellow-500",
    danger: "text-red-500"
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow-md">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-bold ${colorMap[status]}`}>
        {value}
      </div>
    </div>
  )
}
```

---

# ⚠️ PRIORITY ACTION CARD

```tsx
export function ActionCard({ title, priority, cost, impact }) {
  const color = {
    high: "border-red-500",
    medium: "border-yellow-400",
    low: "border-green-400"
  }

  return (
    <div className={`border-l-4 ${color[priority]} bg-white p-4 rounded-xl shadow`}>
      <h3 className="font-semibold text-lg">{title}</h3>
      <div className="text-sm text-gray-500 mt-1">
        Cost: {cost} · Impact: {impact}
      </div>
    </div>
  )
}
```

---

# 🖼️ PHOTO CARD

```tsx
export function PhotoCard({ image, score, label }) {
  const badgeColor = {
    "Needs Retake": "bg-red-500",
    "Usable": "bg-yellow-500",
    "Strong": "bg-green-500"
  }

  return (
    <div className="relative rounded-xl overflow-hidden shadow">
      <img src={image} className="w-full h-48 object-cover" />
      <div className={`absolute top-2 left-2 text-white px-2 py-1 text-xs rounded ${badgeColor[label]}`}>
        {label}
      </div>
      <div className="p-2 text-sm">Score: {score}</div>
    </div>
  )
}
```

---

# 💰 ROI CARD

```tsx
export function ROICard({ upside, cost }) {
  return (
    <div className="bg-green-50 border border-green-200 p-6 rounded-2xl">
      <div className="text-xl font-bold text-green-700">
        ${upside} Potential Upside
      </div>
      <div className="text-sm text-gray-600">
        Estimated Cost: ${cost}
      </div>
    </div>
  )
}
```

---

# 🧭 QUICK SUMMARY PAGE

```tsx
export function QuickSummary({ data }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Quick Summary</h1>
      <ReadinessDashboard data={data} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.topActions.map(a => (
          <ActionCard key={a.id} {...a} />
        ))}
      </div>
      <ROICard upside={2720} cost={1700} />
    </div>
  )
}
```

---

# 🏡 FLYER HERO COMPONENT

```tsx
export function FlyerHero({ title, subtitle, mode }) {
  const modeText = {
    preview: "Coming Soon",
    ready: "Now Available",
    premium: "Featured Listing"
  }

  return (
    <div className="relative h-96 bg-black text-white">
      <div className="absolute bottom-6 left-6">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="text-lg">{subtitle}</p>
        <span className="bg-white text-black px-3 py-1 rounded-full text-sm">
          {modeText[mode]}
        </span>
      </div>
    </div>
  )
}
```

---

# 📞 CTA COMPONENT

```tsx
export function CTAButton({ label }) {
  return (
    <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold shadow hover:bg-blue-700">
      {label}
    </button>
  )
}
```

---

# 🎯 FINAL NOTES FOR CODEX

- Use grid layouts consistently
- Keep spacing uniform
- Avoid long paragraphs
- Prefer cards over text blocks
- Maintain PDF compatibility (avoid dynamic-only UI)

---

# ✅ EXPECTED RESULT

After implementing:

Seller Report:
- Clean dashboard
- Easy to scan
- Actionable

Flyer:
- Conversion-focused
- Visually strong
- Aligned with readiness
