# PinGlass Admin Panel Design System

A comprehensive design system documentation for the PinGlass Admin Panel, establishing consistent patterns for enterprise/admin UI components and interactions.

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Layout System](#3-layout-system)
4. [Data Display Components](#4-data-display-components)
5. [Form Components](#5-form-components)
6. [Action Components](#6-action-components)
7. [Navigation Patterns](#7-navigation-patterns)
8. [Admin Screens Inventory](#8-admin-screens-inventory)
9. [Role-Based UI Patterns](#9-role-based-ui-patterns)
10. [Empty States and Loading](#10-empty-states-and-loading)

---

## 1. Color System

### 1.1 Neutral Professional Palette

The admin panel uses Tailwind CSS Slate as the primary neutral palette for a clean, professional appearance.

```css
/* Background Colors */
--bg-page: slate-50;           /* #f8fafc - Main page background */
--bg-card: white;              /* #ffffff - Card backgrounds */
--bg-muted: slate-100;         /* #f1f5f9 - Muted backgrounds, table headers */
--bg-subtle: slate-50;         /* #f8fafc - Subtle backgrounds */

/* Text Colors */
--text-primary: slate-800;     /* #1e293b - Primary headings, important text */
--text-secondary: slate-700;   /* #334155 - Body text */
--text-muted: slate-500;       /* #64748b - Secondary information */
--text-subtle: slate-400;      /* #94a3b8 - Placeholders, hints */

/* Border Colors */
--border-default: slate-200;   /* #e2e8f0 - Default borders */
--border-subtle: slate-100;    /* #f1f5f9 - Subtle dividers */
--border-strong: slate-300;    /* #cbd5e1 - Emphasized borders */
```

### 1.2 Status Colors

Status indicators follow a consistent semantic color system.

| Status | Background | Text | Border | Use Case |
|--------|------------|------|--------|----------|
| **Pending/Warning** | `amber-100` | `amber-700` | `amber-200` | Pending payments, queued items, SLA warnings |
| **Success** | `emerald-100` | `emerald-700` | `emerald-200` | Completed operations, successful payments |
| **Error/Destructive** | `red-100` | `red-700` | `red-200` | Failed operations, banned users, SLA breached |
| **Info/Processing** | `blue-100` | `blue-700` | `blue-200` | In-progress items, informational badges |
| **Neutral/Canceled** | `slate-100` | `slate-600` | `slate-200` | Canceled, closed, inactive items |

```tsx
// Status Badge Implementation Pattern
const statusStyles = {
  succeeded: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  failed: "bg-red-100 text-red-700 border-red-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  canceled: "bg-slate-100 text-slate-600 border-slate-200",
  refunded: "bg-red-100 text-red-600 border-red-200"
}
```

### 1.3 Provider Colors

Payment provider branding colors for visual differentiation.

| Provider | Background | Text | Icon | Border |
|----------|------------|------|------|--------|
| **T-Bank** | `red-100` | `red-700` | `red-600` | `red-200` |
| **Telegram Stars** | `yellow-100` / `purple-100` | `yellow-700` / `purple-700` | `yellow-600` / `purple-600` | `yellow-200` / `purple-200` |
| **TON Crypto** | `blue-100` | `blue-700` | `blue-600` | `blue-200` |

```tsx
// Provider Badge Configuration
const providerConfig = {
  tbank: {
    label: 'T-Bank',
    icon: '🏦',
    className: 'bg-red-100 text-red-700'
  },
  stars: {
    label: 'Stars',
    icon: '⭐',
    className: 'bg-yellow-100 text-yellow-700'
  },
  ton: {
    label: 'TON',
    icon: '💎',
    className: 'bg-blue-100 text-blue-700'
  }
}
```

### 1.4 Chart Colors

A coordinated 5-color palette for data visualizations.

```css
/* Primary Chart Colors */
--chart-primary: #10B981;      /* Emerald-500 - Revenue, success metrics */
--chart-secondary: #3B82F6;    /* Blue-500 - Secondary data series */
--chart-tertiary: #8B5CF6;     /* Purple-500 - Third data series */
--chart-quaternary: #F59E0B;   /* Amber-500 - Warnings, alerts */
--chart-quinary: #EC4899;      /* Pink-500 - Accent, brand color */

/* Chart Gradient (Area Charts) */
linearGradient: {
  start: "rgba(16, 185, 129, 0.2)",  /* Emerald with 20% opacity */
  end: "rgba(16, 185, 129, 0)"       /* Fade to transparent */
}
```

### 1.5 KPI Card Color Variants

```tsx
const kpiColorClasses = {
  default: {
    bg: 'bg-white border-slate-200',
    icon: 'bg-slate-100 text-slate-600',
    trend: 'text-slate-600'
  },
  green: {
    bg: 'bg-white border-emerald-200',
    icon: 'bg-emerald-100 text-emerald-600',
    trend: 'text-emerald-600'
  },
  blue: {
    bg: 'bg-white border-blue-200',
    icon: 'bg-blue-100 text-blue-600',
    trend: 'text-blue-600'
  },
  yellow: {
    bg: 'bg-white border-amber-200',
    icon: 'bg-amber-100 text-amber-600',
    trend: 'text-amber-600'
  },
  purple: {
    bg: 'bg-white border-purple-200',
    icon: 'bg-purple-100 text-purple-600',
    trend: 'text-purple-600'
  },
  red: {
    bg: 'bg-white border-red-200',
    icon: 'bg-red-100 text-red-600',
    trend: 'text-red-600'
  }
}
```

---

## 2. Typography

### 2.1 Font Stack

```css
/* System Font Stack */
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
             "Helvetica Neue", Arial, sans-serif;

/* Monospace Font (for IDs, codes, timestamps) */
font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo,
             Consolas, "Liberation Mono", monospace;
```

### 2.2 Data-Focused Type Scale

| Element | Size | Weight | Class | Use Case |
|---------|------|--------|-------|----------|
| Page Title | 24px | Bold (700) | `text-2xl font-bold` | Page headings |
| Section Title | 18px | Semibold (600) | `text-lg font-semibold` | Card titles, section headers |
| Card Title | 14px | Semibold (600) | `text-sm font-semibold` | KPI labels, stat titles |
| Body Text | 14px | Normal (400) | `text-sm` | General content |
| Small Text | 12px | Normal (400) | `text-xs` | Subtitles, metadata |
| Micro Text | 10px | Medium (500) | `text-[10px] font-medium` | Timestamps, badges |
| KPI Value | 24-32px | Bold (700) | `text-2xl font-bold` | Primary metrics |

### 2.3 Monospace Typography

Used for machine-readable content requiring visual consistency.

```tsx
// IDs and Codes
<span className="font-mono text-sm">#12345</span>
<span className="font-mono text-xs">1234567890</span>

// Telegram User IDs
<td className="text-sm font-mono">{user.telegram_user_id}</td>

// Payment IDs
<td className="text-sm font-mono">#{payment.id}</td>

// Timestamps (when precise)
<span className="font-mono text-xs">{formatTimestamp(date)}</span>

// Ticket Numbers
<span className="font-mono text-lg font-bold">{ticket.ticket_number}</span>
```

### 2.4 Table Typography

```tsx
// Table Header
<th className="px-4 py-3 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
  Column Name
</th>

// Table Cell (Default)
<td className="px-4 py-3 text-sm text-slate-700">
  Cell content
</td>

// Table Cell (Muted)
<td className="px-4 py-3 text-sm text-slate-500">
  Secondary content
</td>

// Table Cell (Monospace)
<td className="px-4 py-3 text-sm font-mono text-slate-700">
  #123456
</td>
```

---

## 3. Layout System

### 3.1 Page Structure

```
+----------------------------------------------------------+
|  HEADER (sticky, z-50)                                    |
|  [Logo] [Title]                        [User] [Logout]    |
+----------------------------------------------------------+
|  TAB NAVIGATION (sticky below header, z-40)               |
|  [Dashboard] [Users] [Payments] [Generations] [...]       |
+----------------------------------------------------------+
|                                                           |
|  MAIN CONTENT AREA                                        |
|  .container-max .px-6 .py-8                               |
|                                                           |
|  +------------------------------------------------------+ |
|  |  Page Header (title + actions)                       | |
|  +------------------------------------------------------+ |
|                                                           |
|  +------------------------------------------------------+ |
|  |  KPI Cards / Stats Row                               | |
|  +------------------------------------------------------+ |
|                                                           |
|  +------------------------------------------------------+ |
|  |  Filters Bar                                         | |
|  +------------------------------------------------------+ |
|                                                           |
|  +------------------------------------------------------+ |
|  |  Data Table / Content Area                           | |
|  +------------------------------------------------------+ |
|                                                           |
+----------------------------------------------------------+
```

### 3.2 Container and Spacing

```css
/* Max-width Container */
.container-max {
  max-width: 1400px;
  margin: 0 auto;
}

/* Page Padding */
.page-content {
  padding: 2rem 1.5rem;  /* py-8 px-6 */
}

/* Card Spacing */
.card {
  padding: 1.5rem;       /* p-6 */
  border-radius: 0.75rem; /* rounded-xl */
}

/* Section Spacing */
.section-gap {
  margin-bottom: 1.5rem; /* space-y-6 */
}
```

### 3.3 Responsive Breakpoints

| Breakpoint | Width | Columns | Use Case |
|------------|-------|---------|----------|
| Mobile | < 768px | 1-2 | Card stacking, hamburger menu |
| Tablet | 768px+ | 2-3 | Side-by-side cards |
| Desktop | 1024px+ | 4+ | Full dashboard layout |
| Wide | 1400px+ | 6+ | Extended data tables |

### 3.4 Grid Systems

```tsx
// KPI Cards Grid (4 columns on desktop)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {/* KPI Cards */}
</div>

// Provider Cards Grid (3 columns)
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Provider Stats */}
</div>

// Charts Grid (2 columns on desktop)
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Charts */}
</div>

// Stats Grid (5-6 columns on wide screens)
<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
  {/* Stats Cards */}
</div>

// Settings Cards Grid (3 columns)
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  {/* Pricing Tier Cards */}
</div>
```

### 3.5 Header Structure

```tsx
// Main Header (sticky, z-50)
<header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
  <div className="container-max px-6 py-4">
    <div className="flex items-center justify-between">
      {/* Logo + Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center">
          <Shield className="w-5 h-5 text-pink-600" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">PinGlass Admin Panel</h1>
          <p className="text-xs text-slate-500">Управление и мониторинг</p>
        </div>
      </div>

      {/* User Info + Actions */}
      <AdminHeaderActions />
    </div>
  </div>
</header>
```

### 3.6 Navigation Structure

```tsx
// Tab Navigation (sticky below header, z-40)
<nav className="border-b border-slate-200 bg-white/60 backdrop-blur-sm sticky top-[73px] z-40">
  <div className="container-max px-4 md:px-6">
    {/* Mobile: Hamburger Menu */}
    <div className="md:hidden">
      <button className="flex items-center gap-2 px-3 py-2">
        <Menu className="w-5 h-5" />
        <span>{activeItem.label}</span>
      </button>
    </div>

    {/* Desktop: Horizontal Tabs */}
    <div className="hidden md:flex gap-1 overflow-x-auto">
      {navItems.map(item => (
        <Link
          href={item.href}
          className={`
            flex items-center gap-2 px-4 py-3 text-sm font-medium
            rounded-t-xl transition-all relative
            ${isActive ? 'text-slate-800 bg-slate-100' : 'text-slate-500 hover:text-slate-800'}
          `}
        >
          {item.icon}
          <span>{item.label}</span>
          {/* Active indicator line */}
          <span className={`absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500
            ${isActive ? 'scale-x-100' : 'scale-x-0'}`}
          />
        </Link>
      ))}
    </div>
  </div>
</nav>
```

---

## 4. Data Display Components

### 4.1 KPI Cards

Key Performance Indicator cards for displaying primary metrics.

```
+--------------------------------------------------+
|  [Title]                              [Icon]     |
|                                                  |
|  [Large Value]                                   |
|  [Subtitle or Trend] [+12%] vs last period       |
+--------------------------------------------------+
```

**Props Interface:**
```tsx
interface KPICardProps {
  title: string           // Label above value
  value: string           // Primary metric value
  subtitle?: string       // Additional context
  icon?: React.ReactNode  // Lucide icon
  trend?: number          // Percentage change (+/-)
  trendLabel?: string     // "vs last month"
  color?: 'default' | 'green' | 'blue' | 'yellow' | 'purple' | 'red'
}
```

**Implementation:**
```tsx
<KPICard
  title="Пользователи"
  value="1,234"
  subtitle="123 Pro"
  icon={<Users className="w-5 h-5" />}
  trend={12.5}
  trendLabel="vs last month"
  color="blue"
/>
```

### 4.2 Data Tables

Standard table structure for displaying records.

```
+--------+----------+--------+--------+--------+----------+
| Header | Header   | Header | Header | Header | Actions  |
+--------+----------+--------+--------+--------+----------+
| Cell   | Cell     | Badge  | Cell   | Cell   | [Eye]    |
| Cell   | Cell     | Badge  | Cell   | Cell   | [...]    |
| Cell   | Cell     | Badge  | Cell   | Cell   | [...]    |
+--------+----------+--------+--------+--------+----------+
| Pagination: Page 1 of 10          | [Prev] [Next] |
+--------+----------+--------+--------+--------+----------+
```

**Table Container:**
```tsx
<div className="rounded-xl border border-slate-200 overflow-hidden">
  <table className="w-full">
    <thead className="bg-slate-50 border-b border-slate-200">
      <tr className="text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
        <th className="px-4 py-3">Column</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      <tr className="hover:bg-slate-50 transition-colors">
        <td className="px-4 py-3 text-sm">{value}</td>
      </tr>
    </tbody>
  </table>
</div>
```

**Mobile Card View Pattern:**
```tsx
// Switch to card layout on mobile
<div className="md:hidden divide-y divide-border">
  {items.map(item => (
    <div className="p-4 space-y-2">
      {/* Compact card layout */}
    </div>
  ))}
</div>

<table className="w-full hidden md:table">
  {/* Full table on desktop */}
</table>
```

### 4.3 Charts (Recharts)

**Area Chart Configuration:**
```tsx
<ResponsiveContainer width="100%" height="100%">
  <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
    <defs>
      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
      </linearGradient>
    </defs>
    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
    <XAxis
      dataKey="date"
      stroke="#64748b"
      fontSize={12}
      tickLine={false}
      axisLine={false}
    />
    <YAxis
      stroke="#64748b"
      fontSize={12}
      tickLine={false}
      axisLine={false}
      width={50}
    />
    <Tooltip content={<CustomTooltip />} />
    <Area
      type="monotone"
      dataKey="revenue"
      stroke="#10B981"
      strokeWidth={2}
      fillOpacity={1}
      fill="url(#colorRevenue)"
    />
  </AreaChart>
</ResponsiveContainer>
```

**Custom Tooltip Pattern:**
```tsx
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shadow-xl">
      <p className="text-sm text-slate-600 mb-2 font-medium">{formatDate(label)}</p>
      {payload.map((entry, index) => (
        <p key={index} className={`text-sm ${entry.color}`}>
          <span className="text-slate-500">{entry.name}: </span>
          <span className="font-medium">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}
```

### 4.4 Status Badges

Inline badges for displaying status information.

```tsx
// Basic Status Badge
<span className={`
  inline-flex items-center gap-1
  px-2 py-0.5 rounded
  text-xs font-medium
  ${statusStyles[status]}
`}>
  {statusIcon}
  {statusLabel}
</span>

// With Icon
<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
  <CheckCircle className="w-3 h-3" />
  Завершено
</span>

// Provider Badge
<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
  🏦 T-Bank
</span>
```

### 4.5 Progress Indicators

```tsx
// Linear Progress Bar
<div className="flex items-center gap-2">
  <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
    <div
      className={`h-full rounded-full transition-all ${
        status === 'completed' ? 'bg-emerald-500' :
        status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
      }`}
      style={{ width: `${progress}%` }}
    />
  </div>
  <span className="text-xs text-slate-600">
    {completedPhotos}/{totalPhotos}
  </span>
</div>
```

### 4.6 User/Payment Details Modals

**Modal Container:**
```tsx
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
  <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
    {/* Header */}
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-lg font-semibold">{title}</h3>
      <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
        <X className="w-4 h-4" />
      </button>
    </div>

    {/* Content */}
    <div className="space-y-4">
      {/* Detail rows */}
      <div className="flex justify-between text-sm">
        <span className="text-slate-500">Label:</span>
        <span className="font-medium">{value}</span>
      </div>
    </div>

    {/* Actions */}
    <div className="flex gap-2 mt-6">
      <button className="flex-1 px-4 py-2 bg-primary text-white rounded-lg">
        Primary Action
      </button>
      <button className="px-4 py-2 bg-slate-100 rounded-lg">
        Cancel
      </button>
    </div>
  </div>
</div>
```

---

## 5. Form Components

### 5.1 Search Inputs

```tsx
// Standard Search Input
<input
  type="text"
  placeholder="Поиск..."
  value={search}
  onChange={(e) => setSearch(e.target.value)}
  className="flex-1 px-4 py-2 rounded-xl bg-white border border-slate-200
             text-slate-700 placeholder:text-slate-400
             focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
/>

// With Icon
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
  <input
    type="text"
    placeholder="Поиск..."
    className="w-full pl-10 pr-4 py-2 rounded-lg bg-white border border-slate-200 text-sm"
  />
</div>
```

### 5.2 Date Range Picker

Custom dropdown component with presets and custom range option.

```tsx
// Date Filter Component
<DateFilter
  value={datePreset}  // 'today' | '7d' | '30d' | 'mtd' | 'custom' | 'all'
  customRange={{ from: Date, to: Date }}
  onChange={(preset, range) => handleDateChange(preset, range)}
/>

// Preset Options
const PRESETS = [
  { id: 'all', label: 'Все время' },
  { id: 'today', label: 'Сегодня' },
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'mtd', label: 'Этот месяц' },
  { id: 'custom', label: 'Свой период' }
]
```

**Dropdown Structure:**
```
+----------------------------+
| [Calendar Icon] 7 дней [v] |
+----------------------------+
        |
        v
+----------------------------+
| Все время                  |
| Сегодня               [*]  |
| 7 дней                     |
| 30 дней                    |
| Этот месяц                 |
| Свой период           [>]  |
+----------------------------+

// Custom Period View
+----------------------------+
| Свой период                |
|                            |
| От: [____date input____]   |
| До: [____date input____]   |
|                            |
| [Назад]      [Применить]   |
+----------------------------+
```

### 5.3 Select Dropdowns

```tsx
// Standard Select
<select
  value={filters.status}
  onChange={(e) => handleFilterChange('status', e.target.value)}
  className="px-3 py-2 rounded-lg bg-white border border-slate-200
             text-sm text-slate-700
             focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500"
>
  <option value="">Все статусы</option>
  <option value="succeeded">Успешно</option>
  <option value="pending">В обработке</option>
  <option value="refunded">Возвращено</option>
</select>
```

### 5.4 Toggle Switches

```tsx
// Custom Toggle Switch
<button
  onClick={() => setEnabled(!enabled)}
  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
    enabled ? 'bg-emerald-500' : 'bg-slate-300'
  }`}
>
  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow ${
    enabled ? 'translate-x-6' : 'translate-x-1'
  }`}/>
</button>

// Checkbox Toggle
<label className="flex items-center gap-2 cursor-pointer">
  <input
    type="checkbox"
    checked={autoRefresh}
    onChange={(e) => setAutoRefresh(e.target.checked)}
    className="rounded border-slate-300 bg-white text-pink-500 focus:ring-pink-500"
  />
  <span className="text-sm text-slate-600">Авто-обновление</span>
</label>
```

### 5.5 Multi-Select Filters

```tsx
// Filter Bar Pattern
<div className="flex flex-wrap items-center gap-3 bg-white rounded-xl p-4 border border-slate-200">
  {/* Status Filter */}
  <select className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm">
    <option value="">Все статусы</option>
    {/* options */}
  </select>

  {/* Priority Filter */}
  <select className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm">
    <option value="">Все приоритеты</option>
    {/* options */}
  </select>

  {/* Category Filter */}
  <select className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm">
    <option value="">Все категории</option>
    {/* options */}
  </select>

  {/* Spacer */}
  <div className="flex-1" />

  {/* Action Buttons */}
  <button className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg">
    <RefreshCw className="w-4 h-4" />
    Обновить
  </button>
</div>
```

### 5.6 Text Inputs with Icons

```tsx
// Input with Suffix Icon
<div className="relative">
  <input
    type="number"
    value={price}
    onChange={(e) => setPrice(e.target.value)}
    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-4 py-3 pr-12
               text-slate-800 text-xl font-bold
               focus:outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/20"
  />
  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">₽</span>
</div>

// Input with Prefix Icon
<div className="relative">
  <Star className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400" />
  <input
    type="number"
    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg"
  />
</div>
```

---

## 6. Action Components

### 6.1 Primary/Secondary Buttons

```tsx
// Primary Button (Gradient)
<button className="flex items-center gap-2 px-4 py-2
                   bg-gradient-to-r from-pink-500 to-purple-500
                   hover:from-pink-600 hover:to-purple-600
                   rounded-lg text-white font-medium
                   transition-all shadow-lg shadow-pink-500/25
                   disabled:opacity-50 disabled:cursor-not-allowed">
  <Save className="w-4 h-4" />
  Сохранить
</button>

// Primary Button (Solid)
<button className="px-4 py-2 bg-pink-500 hover:bg-pink-600
                   rounded-lg text-white font-medium transition-colors">
  Действие
</button>

// Secondary Button
<button className="px-4 py-2 bg-white hover:bg-slate-50
                   border border-slate-200 rounded-lg
                   text-slate-700 font-medium transition-colors">
  Отмена
</button>

// Ghost Button
<button className="px-4 py-2 hover:bg-slate-100
                   rounded-lg text-slate-600 transition-colors">
  Отменить
</button>

// Icon Button
<button className="p-2 hover:bg-slate-100 rounded-lg text-slate-500
                   hover:text-slate-700 transition-colors">
  <RefreshCw className="w-4 h-4" />
</button>
```

### 6.2 Destructive Actions

```tsx
// Destructive Button
<button className="flex items-center gap-2 px-4 py-2
                   bg-red-500 hover:bg-red-600
                   rounded-lg text-white font-medium transition-colors">
  <Trash className="w-4 h-4" />
  Удалить
</button>

// Soft Destructive
<button className="flex items-center gap-2 px-4 py-2
                   bg-red-50 hover:bg-red-100 border border-red-200
                   rounded-lg text-red-700 font-medium transition-colors">
  Забанить
</button>

// Refund Button (contextual)
<button className="text-sm text-red-600 hover:text-red-700 hover:underline">
  💸 Возврат
</button>
```

### 6.3 Export Buttons

Dropdown button for export format selection.

```tsx
// Export Button with Dropdown
<ExportButton
  onExport={(format: 'csv' | 'json' | 'xlsx') => handleExport(format)}
  disabled={data.length === 0}
/>

// Structure
+--------------------------------+
| [Download Icon] Экспорт [v]    |
+--------------------------------+
         |
         v
+--------------------------------+
| [FileText]    CSV              |
| [FileSheet]   Excel            |
| [FileJson]    JSON             |
+--------------------------------+
```

### 6.4 Confirm Dialogs

```tsx
// Confirmation Modal Pattern
<div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
  <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
    <h3 className="text-lg font-semibold text-slate-800 mb-2">
      Подтвердите действие
    </h3>
    <p className="text-sm text-slate-600 mb-6">
      Вы уверены, что хотите выполнить это действие? Это нельзя отменить.
    </p>

    <div className="flex gap-2">
      <button className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600
                         rounded-lg text-white font-medium">
        Подтвердить
      </button>
      <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200
                         rounded-lg text-slate-700">
        Отмена
      </button>
    </div>
  </div>
</div>
```

### 6.5 Action Dropdowns

```tsx
// Actions Menu (three dots)
<div className="relative">
  <button
    onClick={() => setOpen(!open)}
    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
  >
    <MoreHorizontal className="w-4 h-4" />
  </button>

  {open && (
    <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200
                    rounded-lg shadow-xl z-10">
      <button className="w-full flex items-center gap-2 px-4 py-2 text-sm
                         hover:bg-slate-50 text-left">
        <Eye className="w-4 h-4" />
        Детали
      </button>
      <button className="w-full flex items-center gap-2 px-4 py-2 text-sm
                         hover:bg-slate-50 text-left text-red-600">
        <Ban className="w-4 h-4" />
        Забанить
      </button>
    </div>
  )}
</div>
```

---

## 7. Navigation Patterns

### 7.1 Tab Navigation (11 Sections)

```tsx
const navItems = [
  { href: "/admin", icon: <LayoutDashboard />, label: "Dashboard", exact: true },
  { href: "/admin/users", icon: <Users />, label: "Users" },
  { href: "/admin/payments", icon: <DollarSign />, label: "Payments" },
  { href: "/admin/generations", icon: <Zap />, label: "Generations" },
  { href: "/admin/prompt-testing", icon: <Sparkles />, label: "Prompts" },
  { href: "/admin/referrals", icon: <Gift />, label: "Referrals" },
  { href: "/admin/partners", icon: <Crown />, label: "Partners" },
  { href: "/admin/telegram", icon: <MessageSquare />, label: "Telegram" },
  { href: "/admin/tickets", icon: <Ticket />, label: "Support" },
  { href: "/admin/logs", icon: <Activity />, label: "Logs" },
  { href: "/admin/settings", icon: <Settings />, label: "Settings" }
]
```

**Active State:**
```tsx
// Tab Item with Active Indicator
<Link
  href={item.href}
  className={`
    flex items-center gap-2 px-4 py-3 text-sm font-medium
    rounded-t-xl transition-all relative
    ${isActive
      ? 'text-slate-800 bg-slate-100'
      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}
  `}
>
  {item.icon}
  <span>{item.label}</span>
  {/* Active indicator line */}
  <span className={`
    absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500 transition-transform
    ${isActive ? 'scale-x-100' : 'scale-x-0'}
  `} />
</Link>
```

### 7.2 Mobile Navigation (Hamburger Menu)

```tsx
// Mobile Menu Toggle
<div className="md:hidden flex items-center justify-between py-2">
  <button
    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
    className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
  >
    {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    <span className="font-medium text-sm">{activeItem?.label || 'Menu'}</span>
  </button>
</div>

// Mobile Dropdown Menu
{mobileMenuOpen && (
  <div className="md:hidden absolute left-0 right-0 bg-white border-b border-slate-200 shadow-lg z-50">
    <div className="p-2 grid grid-cols-2 gap-1">
      {navItems.map(item => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg
            ${isActive ? 'text-slate-800 bg-blue-50' : 'text-slate-600 hover:bg-slate-50'}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  </div>
)}
```

### 7.3 Command Palette (Cmd+K)

Global search modal with keyboard navigation.

```
+----------------------------------------------------------+
|  [Search Icon] Search users, payments, generations...    |
|                                             [X]          |
+----------------------------------------------------------+
|                                                          |
|  QUICK ACTIONS (when query empty)                        |
|  > Dashboard           Главная страница                  |
|  > Users               Управление пользователями         |
|  > Payments            История платежей                  |
|                                                          |
|  SEARCH RESULTS (when query >= 2 chars)                  |
|  [User Icon] @username        user                       |
|  [Card Icon] Payment #123     payment                    |
|                                                          |
+----------------------------------------------------------+
|  [Arrow] navigate    [Enter] select    [Esc] close   ⌘K |
+----------------------------------------------------------+
```

**Keyboard Shortcuts:**
- `Cmd+K` / `Ctrl+K` - Toggle palette
- `Escape` - Close
- `Arrow Up/Down` - Navigate items
- `Enter` - Select item

### 7.4 Notification Bell

```tsx
// Notification Bell with Badge
<div className="relative">
  <button className="relative p-2 rounded-lg hover:bg-slate-200
                     text-slate-500 hover:text-slate-700 transition-colors">
    <Bell className="w-5 h-5" />
    {unreadCount > 0 && (
      <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full
                       text-[10px] font-bold text-white flex items-center justify-center">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </button>
</div>
```

**Notification Dropdown:**
```
+----------------------------------------+
| Уведомления            [Mark all read] |
+----------------------------------------+
| [Success] Payment received   •         |
|   User paid 999₽                       |
|   2 мин назад                          |
+----------------------------------------+
| [Warning] Generation failed            |
|   Job #123 failed                      |
|   1 час назад                          |
+----------------------------------------+
|              Закрыть                   |
+----------------------------------------+
```

---

## 8. Admin Screens Inventory

### 8.1 Dashboard

**Purpose:** High-level overview of system health and key metrics.

```
+----------------------------------------------------------+
| Dashboard                           [Last updated] [Refresh] |
+----------------------------------------------------------+
|                                                            |
| +------------+ +------------+ +------------+ +------------+ |
| | Users      | | Revenue MTD| | Avg Check  | | Generations| |
| | 1,234      | | 45,678₽    | | 856₽       | | 567        | |
| | 123 Pro    | | Today: 5K  | | 12% conv   | | 3 in queue | |
| +------------+ +------------+ +------------+ +------------+ |
|                                                            |
| +------------+ +------------+ +------------+               |
| | T-Bank     | | Stars      | | TON        |               |
| | 35,000₽    | | 2,500⭐    | | 45.5 TON   |               |
| | 45 payments| | 12 payments| | 8 payments |               |
| +------------+ +------------+ +------------+               |
|                                                            |
| +---------------------------+ +---------------------------+ |
| | Revenue Chart (30 days)   | | Tier Distribution (Pie)   | |
| |     ___/\___/\__          | |      [Starter: 30%]       | |
| |   _/            \_        | |      [Standard: 45%]      | |
| | _/                \       | |      [Premium: 25%]       | |
| +---------------------------+ +---------------------------+ |
|                                                            |
| +---------------------------+ +---------------------------+ |
| | Registrations (Line)      | | Recent Activity           | |
| |   ___/\___/\__            | | [Payment] user123 - 999₽  | |
| |                           | | [User] new registration   | |
| |                           | | [Gen] completed #456      | |
| +---------------------------+ +---------------------------+ |
+----------------------------------------------------------+
```

**Components:**
- 4x KPI Cards (Users, Revenue, Avg Check, Generations)
- 3x Provider Revenue Cards (T-Bank, Stars, TON)
- 2x Charts (Revenue trend, Tier distribution)
- 1x Registrations chart
- 1x Recent Activity feed

### 8.2 Users

**Purpose:** User management with search, filtering, and detailed user information.

```
+----------------------------------------------------------+
| [Search input________________] [Refresh]                  |
| Total users: 1,234                                        |
+----------------------------------------------------------+
| ID  | TG ID      | Username | Status | Avatars | Spent | Actions |
|-----|------------|----------|--------|---------|-------|---------|
| 1   | 123456789  | @user1   | Partner| 5       | 4,997₽| [...] |
| 2   | 987654321  | @user2   | -      | 2       | 999₽  | [...] |
| 3   | 111222333  | -        | Banned | 0       | 0₽    | [...] |
+----------------------------------------------------------+
| Page 1 of 50                              [<] [>]         |
+----------------------------------------------------------+
```

**User Details Modal:**
```
+----------------------------------------+
| User Details                     [X]   |
+----------------------------------------+
| TG ID: 123456789                       |
| Username: @username                    |
| Status: Active / Banned / Partner      |
| Created: 01.01.2024                    |
|                                        |
| --- Stats ---                          |
| Avatars: 5                             |
| Payments: 3                            |
| Total Spent: 2,997₽                    |
| Reference Photos: 24                   |
| Generated Photos: 69                   |
|                                        |
| --- Telegram Status ---                |
| Sent: 45                               |
| Pending: 2                             |
| Failed: 0                              |
|                                        |
| [Ban User] [Make Partner]              |
+----------------------------------------+
```

### 8.3 Payments

**Purpose:** Payment tracking, filtering by status/provider, refund management.

```
+----------------------------------------------------------+
| +------------+ +------------+ +------------+               |
| | Total Rev  | | Net Revenue| | Avg Order  |               |
| | 150,000₽   | | 145,000₽   | | 856₽       |               |
| +------------+ +------------+ +------------+               |
|                                                            |
| +------------+ +------------+ +------------+               |
| | T-Bank     | | Stars      | | TON        |               |
| | 100,000₽   | | 30,000₽    | | 20,000₽    |               |
| +------------+ +------------+ +------------+               |
+----------------------------------------------------------+
| [Status v] [Tier v] [Provider v] [Date v]  [Export] [Refresh] |
+----------------------------------------------------------+
| ID | User      | Amount | Tier    | Status   | Provider | Date     | Actions |
|----|-----------|--------|---------|----------|----------|----------|---------|
| 1  | @user1    | 999₽   | standard| succeeded| T-Bank   | 01.01.24 | [Eye] [Refund] |
| 2  | @user2    | 250⭐   | starter | succeeded| Stars    | 01.01.24 | [Eye] |
| 3  | 12345678  | 5.5 TON| premium | pending  | TON      | 01.01.24 | [Eye] |
+----------------------------------------------------------+
```

**Refund Flow:**
```
+----------------------------------------+
| Create Refund                    [X]   |
+----------------------------------------+
| Payment: #123                          |
| Amount: 999₽                           |
| Already refunded: 0₽                   |
| Available for refund: 999₽             |
|                                        |
| Reason (required):                     |
| [_________________________________]    |
| [_________________________________]    |
|                                        |
| [Create Refund] [Cancel]               |
+----------------------------------------+
```

### 8.4 Generations

**Purpose:** Monitor AI generation jobs, retry failed jobs.

```
+----------------------------------------------------------+
| +--------+ +--------+ +--------+ +--------+ +--------+ +--------+ |
| | Total  | | Done   | | Active | | Failed | | Rate   | | Avg Time |
| | 1,234  | | 1,200  | | 5      | | 29     | | 97.6%  | | 4m 30s |
| +--------+ +--------+ +--------+ +--------+ +--------+ +--------+ |
+----------------------------------------------------------+
| [Status v] [Date v]          [x] Auto-refresh    [Refresh] |
+----------------------------------------------------------+
| ID  | Avatar    | Style  | Progress | Status   | Time | Actions |
|-----|-----------|--------|----------|----------|------|---------|
| 123 | User #1   | prof   | ████████ | completed| 4m   | [Eye]   |
| 124 | User #2   | life   | ████░░░░ | processing| -   | [Eye]   |
| 125 | User #3   | creat  | ████████ | failed   | 2m   | [Eye] [Retry] |
+----------------------------------------------------------+
```

**Generation Details Modal:**
```
+----------------------------------------+
| Generation #123                  [X]   |
+----------------------------------------+
| Status: [Completed]                    |
| Avatar: User #1                        |
| Style: professional                    |
| Progress: 23/23 photos                 |
| Duration: 4m 30s                       |
|                                        |
| --- Photos ---                         |
| [Thumbnail Grid of Generated Photos]   |
|                                        |
| --- Kie Tasks ---                      |
| Task 1: completed - url                |
| Task 2: completed - url                |
| ...                                    |
|                                        |
| [Retry Failed] [Download All]          |
+----------------------------------------+
```

### 8.5 Referrals

**Purpose:** Referral program stats, top referrers, withdrawal management.

```
+----------------------------------------------------------+
| +------------+ +------------+ +------------+ +------------+ |
| | Total Refs | | Active     | | Earnings   | | Withdrawn  | |
| | 234        | | 156        | | 45,678₽    | | 30,000₽    | |
| +------------+ +------------+ +------------+ +------------+ |
+----------------------------------------------------------+
| Top Referrers                                              |
+----------------------------------------------------------+
| User      | Referrals | Earned  | Balance | Withdrawn      |
|-----------|-----------|---------|---------|----------------|
| @user1    | 45        | 22,500₽ | 5,000₽  | 17,500₽        |
| @user2    | 32        | 16,000₽ | 3,200₽  | 12,800₽        |
+----------------------------------------------------------+
| Pending Withdrawals                                        |
+----------------------------------------------------------+
| User      | Amount  | Requested | Status  | Actions        |
|-----------|---------|-----------|---------|----------------|
| @user3    | 2,000₽  | 01.01.24  | pending | [Approve] [Reject] |
+----------------------------------------------------------+
```

### 8.6 Partners

**Purpose:** Partner application workflow, commission management.

```
+----------------------------------------------------------+
| Partner Applications                                       |
+----------------------------------------------------------+
| [Pending] [Approved] [Rejected]                           |
+----------------------------------------------------------+
| User      | Applied   | Refs | Total Earned | Actions     |
|-----------|-----------|------|--------------|-------------|
| @user1    | 01.01.24  | 45   | 22,500₽      | [Review]    |
| @user2    | 02.01.24  | 32   | 16,000₽      | [Review]    |
+----------------------------------------------------------+

Application Review Modal:
+----------------------------------------+
| Partner Application              [X]   |
+----------------------------------------+
| User: @username                        |
| Current Stats:                         |
| - Referrals: 45                        |
| - Total Earned: 22,500₽                |
| - Average: 500₽/referral               |
|                                        |
| Commission Rate:                       |
| [50___]% (default: 50%)                |
|                                        |
| [Approve] [Reject] [Cancel]            |
+----------------------------------------+
```

### 8.7 Telegram

**Purpose:** Broadcast messages, view message queue status.

```
+----------------------------------------------------------+
| Telegram Broadcast                                         |
+----------------------------------------------------------+
| Target Audience:                                           |
| ( ) All Users                                              |
| ( ) Pro Users Only                                         |
| ( ) Users with Pending Generations                         |
|                                                            |
| Message:                                                   |
| [_________________________________________________]       |
| [_________________________________________________]       |
| [_________________________________________________]       |
|                                                            |
| [Preview] [Send to X users]                                |
+----------------------------------------------------------+
| Message Queue                                              |
+----------------------------------------------------------+
| ID | User      | Message | Status  | Sent At | Attempts   |
|----|-----------|---------|---------|---------|------------|
| 1  | @user1    | Photo...| sent    | 12:00   | 1          |
| 2  | @user2    | Photo...| pending | -       | 0          |
| 3  | @user3    | Photo...| failed  | 12:01   | 3          |
+----------------------------------------------------------+
```

### 8.8 Tickets (Support)

**Purpose:** Customer support with SLA tracking, messaging.

```
+----------------------------------------------------------+
| +--------+ +--------+ +--------+ +--------+ +--------+    |
| | Total  | | Open   | | Working| | SLA Bad| | Avg Time|   |
| | 156    | | 23     | | 12     | | 3      | | 45m     |   |
| +--------+ +--------+ +--------+ +--------+ +--------+    |
+----------------------------------------------------------+
| [Search___] [Status v] [Priority v] [Category v] [Refresh] |
+----------------------------------------------------------+
| Number   | User    | Category | Priority | Status  | SLA  | |
|----------|---------|----------|----------|---------|------|---|
| TKT-001  | @user1  | Payment  | P1       | Open    | -2h  | [Eye] |
| TKT-002  | @user2  | Generation| P2      | Working | 4h   | [Eye] |
| TKT-003  | @user3  | Technical| P3       | Waiting | 12h  | [Eye] |
+----------------------------------------------------------+
```

**Ticket Detail Modal:**
```
+----------------------------------------------------------+
| TKT-001  [P1] [Open]                              [X]     |
| Subject: Payment not received                             |
+----------------------------------------------------------+
| User: @username                                           |
| Category: [Payment]  SLA: [-2h]                           |
+----------------------------------------------------------+
| Messages:                                                  |
|                                                            |
| [User bubble]                                              |
| I paid but didn't receive access                          |
| 01.01 12:00                                               |
|                                                            |
|                              [Operator bubble]             |
|                              Checking your payment...      |
|                              01.01 12:15                   |
|                                                            |
+----------------------------------------------------------+
| [Reply textarea___________________________]               |
|                                          [Send]           |
+----------------------------------------------------------+
| Actions Panel:                                            |
| Status: [Dropdown]                                        |
| Priority: [Dropdown]                                      |
| Assign: [Input]                                           |
| [Save Changes] [Escalate]                                 |
+----------------------------------------------------------+
```

### 8.9 Logs (Sentry Integration)

**Purpose:** Error monitoring and debugging.

```
+----------------------------------------------------------+
| Logs / Error Monitoring                                    |
+----------------------------------------------------------+
| [Level v] [Date v] [Component v] [Search___] [Refresh]    |
+----------------------------------------------------------+
| Time     | Level | Component | Message              | Actions |
|----------|-------|-----------|----------------------|---------|
| 12:00:01 | ERROR | payments  | Payment webhook fail | [Eye]   |
| 12:00:02 | WARN  | generation| Slow response from API| [Eye]  |
| 12:00:03 | INFO  | users     | New user registered  | [Eye]   |
+----------------------------------------------------------+

Level Badges:
- ERROR: bg-red-100 text-red-700
- WARN:  bg-amber-100 text-amber-700
- INFO:  bg-blue-100 text-blue-700
- DEBUG: bg-slate-100 text-slate-600
```

### 8.10 Settings

**Purpose:** System configuration - pricing, payment methods, T-Bank credentials.

```
+----------------------------------------------------------+
| Settings                                    [Save All]    |
+----------------------------------------------------------+
|                                                            |
| PRICING TIERS                                              |
| +----------------+ +----------------+ +----------------+   |
| | Starter        | | Standard  [*]  | | Premium        |   |
| | Price: 499₽    | | Price: 999₽    | | Price: 1499₽   |   |
| | Photos: 7      | | Photos: 15     | | Photos: 23     |   |
| | Discount: 0%   | | Discount: 10%  | | Discount: 0%   |   |
| | [x] Active     | | [x] Active     | | [x] Active     |   |
| | [ ] Popular    | | [x] Popular    | | [ ] Popular    |   |
| +----------------+ +----------------+ +----------------+   |
|                                                            |
| Preview: [Starter 499₽] [Standard 899₽ -10%] [Premium 1499₽] |
|                                                            |
+----------------------------------------------------------+
| PAYMENT METHODS                                            |
+----------------------------------------------------------+
| +----------------------------------------------------+    |
| | T-Bank (Cards)                           [Toggle]  |    |
| | Visa, Mastercard, MIR                              |    |
| +----------------------------------------------------+    |
|                                                            |
| +----------------------------------------------------+    |
| | Telegram Stars                           [Toggle]  |    |
| | Starter: 275⭐  Standard: 550⭐  Premium: 825⭐     |    |
| +----------------------------------------------------+    |
|                                                            |
| +----------------------------------------------------+    |
| | TON Crypto                               [Toggle]  |    |
| | Wallet: UQ...                                      |    |
| | Starter: 1.5 TON  Standard: 3 TON  Premium: 4.5 TON|    |
| +----------------------------------------------------+    |
+----------------------------------------------------------+
| T-BANK SETTINGS                                            |
+----------------------------------------------------------+
| Mode: [Test] [Production]                                  |
|                                                            |
| Test Credentials:              Prod Credentials:           |
| Terminal: [_________]          Terminal: [_________]       |
| Password: [_________]          Password: [_________]       |
|                                                            |
| [Show/Hide Passwords]                        [Save]        |
+----------------------------------------------------------+
```

---

## 9. Role-Based UI Patterns

### 9.1 Permission Levels

| Role | Description | Permissions |
|------|-------------|-------------|
| **Viewer** | Read-only access | View all data, no actions |
| **Admin** | Standard admin | All actions except system settings |
| **Super Admin** | Full access | All actions including T-Bank credentials |

### 9.2 Permission-Based Button Visibility

```tsx
// Example: Conditional Action Buttons
{hasPermission('users.ban') && (
  <button onClick={handleBan} className="text-red-600">
    Ban User
  </button>
)}

{hasPermission('payments.refund') && (
  <button onClick={handleRefund} className="text-primary">
    Create Refund
  </button>
)}

{hasPermission('settings.tbank') && (
  <section>
    {/* T-Bank Settings Section */}
  </section>
)}
```

### 9.3 Permission Matrix

| Action | Viewer | Admin | Super Admin |
|--------|--------|-------|-------------|
| View Dashboard | Yes | Yes | Yes |
| View Users | Yes | Yes | Yes |
| Ban/Unban Users | No | Yes | Yes |
| View Payments | Yes | Yes | Yes |
| Process Refunds | No | Yes | Yes |
| View Generations | Yes | Yes | Yes |
| Retry Failed Jobs | No | Yes | Yes |
| View Tickets | Yes | Yes | Yes |
| Reply to Tickets | No | Yes | Yes |
| Close Tickets | No | Yes | Yes |
| Send Broadcasts | No | Yes | Yes |
| Edit Pricing | No | No | Yes |
| Edit Payment Methods | No | No | Yes |
| Edit T-Bank Credentials | No | No | Yes |

### 9.4 UI Differences by Role

**Viewer:**
- All action buttons hidden
- Export buttons visible
- Refresh buttons visible
- No edit capability on any forms

**Admin:**
- Most action buttons visible
- Settings page: Pricing section read-only
- T-Bank credentials hidden

**Super Admin:**
- All features enabled
- Full Settings access
- Can view/edit T-Bank credentials
- System health monitoring

---

## 10. Empty States and Loading

### 10.1 Table Skeletons

```tsx
// Table Loading Skeleton
<div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
  <table className="w-full">
    <thead>
      <tr className="border-b border-slate-200 bg-slate-50">
        {Array.from({ length: columns }).map((_, i) => (
          <th key={i} className="px-4 py-3">
            <div className="h-4 bg-slate-200 rounded animate-pulse w-20" />
          </th>
        ))}
      </tr>
    </thead>
    <tbody>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="border-b border-slate-100">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="px-4 py-3">
              <div
                className="h-4 bg-slate-100 rounded animate-pulse"
                style={{
                  width: `${Math.random() * 40 + 60}%`,
                  animationDelay: `${rowIndex * 100 + colIndex * 50}ms`
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

### 10.2 KPI Card Skeletons

```tsx
// KPI Loading Skeleton
<div className="bg-white rounded-xl p-6 border border-slate-200 animate-pulse">
  <div className="h-4 bg-slate-200 rounded w-24 mb-4" />
  <div className="h-8 bg-slate-200 rounded w-32" />
</div>
```

### 10.3 Chart Placeholders

```tsx
// Chart Loading State
<div className="bg-white rounded-xl p-6 h-80 border border-slate-200 animate-pulse">
  <div className="h-4 bg-slate-200 rounded w-32 mb-4" />
  <div className="h-full bg-slate-100 rounded" />
</div>

// Chart No Data State
<div className="h-64 flex items-center justify-center text-slate-500">
  Нет данных за выбранный период
</div>
```

### 10.4 Empty State Messages

```tsx
// Table Empty State
<tr>
  <td colSpan={columns} className="px-4 py-12 text-center text-slate-500">
    <Image className="w-8 h-8 mx-auto mb-2 opacity-50" />
    <p>Записи не найдены</p>
  </td>
</tr>

// Search No Results
<div className="p-8 text-center text-slate-500">
  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
  <p className="text-sm">Ничего не найдено</p>
  <p className="text-xs mt-1">Попробуйте изменить запрос</p>
</div>

// Notifications Empty
<div className="px-4 py-8 text-center text-slate-500">
  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
  <p className="text-sm">Нет уведомлений</p>
</div>

// Tickets Empty
<div className="px-4 py-12 text-center text-slate-500">
  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
  <p>Тикеты не найдены</p>
</div>
```

### 10.5 Loading Indicators

```tsx
// Full Page Loading
<div className="flex items-center justify-center py-12">
  <Loader2 className="w-8 h-8 animate-spin text-pink-500" />
</div>

// Inline Loading (Button)
<button disabled className="flex items-center gap-2 opacity-50">
  <Loader2 className="w-4 h-4 animate-spin" />
  Загрузка...
</button>

// Refresh Button Loading
<button disabled>
  <RefreshCw className="w-4 h-4 animate-spin" />
</button>

// Processing Status Badge
<span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium animate-pulse">
  <Loader2 className="w-3 h-3 animate-spin" />
  В процессе
</span>
```

### 10.6 Error States

```tsx
// Error Alert
<div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
  <div className="flex-1">
    <p className="text-red-600 text-sm">{error}</p>
  </div>
  <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
    <X className="w-4 h-4" />
  </button>
</div>

// Error with Retry
<div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
  <p className="text-red-600 mb-4">{error}</p>
  <button
    onClick={handleRetry}
    className="px-4 py-2 bg-red-100 hover:bg-red-200 rounded-lg text-red-700 font-medium"
  >
    Повторить
  </button>
</div>
```

### 10.7 Success States

```tsx
// Success Alert (auto-dismiss)
<div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3">
  <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
  <p className="text-emerald-600 text-sm">{message}</p>
</div>
```

---

## Appendix: CSS Variables Reference

```css
/* Core Colors */
--color-primary: theme('colors.pink.500');
--color-primary-hover: theme('colors.pink.600');
--color-secondary: theme('colors.purple.500');

/* Status Colors */
--color-success: theme('colors.emerald.500');
--color-warning: theme('colors.amber.500');
--color-error: theme('colors.red.500');
--color-info: theme('colors.blue.500');

/* Neutral Colors */
--color-text-primary: theme('colors.slate.800');
--color-text-secondary: theme('colors.slate.600');
--color-text-muted: theme('colors.slate.500');
--color-bg-page: theme('colors.slate.50');
--color-bg-card: theme('colors.white');
--color-border: theme('colors.slate.200');

/* Spacing */
--spacing-page: theme('spacing.8') theme('spacing.6');
--spacing-card: theme('spacing.6');
--spacing-section: theme('spacing.6');

/* Border Radius */
--radius-sm: theme('borderRadius.lg');
--radius-md: theme('borderRadius.xl');
--radius-lg: theme('borderRadius.2xl');

/* Shadows */
--shadow-sm: theme('boxShadow.sm');
--shadow-md: theme('boxShadow.md');
--shadow-lg: theme('boxShadow.xl');
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-17 | Initial design system documentation |

---

*This design system is maintained by the PinGlass development team. For questions or contributions, please contact the team lead.*
