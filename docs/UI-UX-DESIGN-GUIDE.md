# EcoPlate UI/UX Design Guide

This document defines the design system and guidelines for the EcoPlate application. All developers (including AI assistants like Claude) must follow these guidelines to maintain consistency.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing](#spacing)
5. [Components](#components)
6. [Layout Patterns](#layout-patterns)
7. [Mobile Considerations](#mobile-considerations)
8. [Do's and Don'ts](#dos-and-donts)

---

## Design Principles

### 1. Clean and Minimal
- Avoid clutter. Every element should have a purpose.
- Use whitespace generously to create breathing room.
- No unnecessary decorations or effects.

### 2. Mobile-First
- Design for mobile screens first, then scale up for desktop.
- Touch targets must be at least 44px x 44px.
- Use bottom navigation on mobile, sidebar on desktop.

### 3. Consistent
- Use the same patterns for similar interactions.
- Reuse existing components instead of creating new ones.
- Follow the established color meanings.

### 4. Accessible
- Maintain sufficient color contrast.
- Use semantic HTML elements.
- Support keyboard navigation.

### 5. No Flashy Animations
- Avoid page transition animations (fade-in, slide-up, etc.).
- Keep interactions instant and responsive.
- Only use subtle hover effects on desktop.

---

## Color Palette

The "Eco Sage" theme uses nature-inspired colors. Colors are defined as CSS variables in `frontend/src/index.css`.

### Primary Colors

| Name | Variable | Hex | Usage |
|------|----------|-----|-------|
| Primary | `--primary` | `#5F7A61` | Main actions, active states, links |
| Primary Foreground | `--primary-foreground` | `#F5F5F5` | Text on primary backgrounds |

### Secondary Colors

| Name | Variable | Hex | Usage |
|------|----------|-----|-------|
| Secondary | `--secondary` | `#C17B5C` | Secondary actions, marketplace elements |
| Accent | `--accent` | `#6B4E71` | Special highlights, badges |

### Semantic Colors

| Name | Variable | Hex | Usage |
|------|----------|-----|-------|
| Success | `--success` | `#7B9E7E` | Success states, positive actions |
| Warning | `--warning` | `#E8A547` | Warnings, expiring items |
| Destructive | `--destructive` | `#C85C5C` | Errors, delete actions, expired items |

### Neutral Colors

| Name | Variable | Usage |
|------|----------|-------|
| Background | `--background` | Page backgrounds |
| Card | `--card` | Card backgrounds |
| Muted | `--muted` | Disabled states, secondary backgrounds |
| Muted Foreground | `--muted-foreground` | Secondary text |
| Foreground | `--foreground` | Primary text |
| Border | `--border` | Borders, dividers |

### Usage Rules

```tsx
// CORRECT - Use theme variables
className="bg-primary text-primary-foreground"
className="text-muted-foreground"
className="bg-success/10 text-success"

// INCORRECT - Don't use hardcoded colors
className="bg-green-600 text-white"
className="text-gray-500"
className="bg-yellow-100 text-yellow-800"
```

---

## Typography

### Font Family
- Use system fonts (inherited from Tailwind defaults)
- No custom fonts required

### Font Sizes

| Element | Class | Usage |
|---------|-------|-------|
| Page Title | `text-2xl lg:text-3xl font-bold` | Main page headings |
| Section Title | `text-base font-semibold` or `text-lg font-semibold` | Card titles, section headers |
| Body Text | `text-sm` | Regular content |
| Small Text | `text-xs` | Labels, metadata, timestamps |
| Tiny Text | `text-[10px]` | Badges, tab labels on mobile |

### Text Colors

```tsx
// Primary text
className="text-foreground"

// Secondary/muted text
className="text-muted-foreground"

// Never use gray-500, gray-600, etc. directly
```

---

## Spacing

### Standard Spacing Scale

| Size | Value | Usage |
|------|-------|-------|
| xs | `1` (4px) | Tight gaps |
| sm | `2` (8px) | Icon gaps, tight padding |
| md | `3-4` (12-16px) | Standard gaps |
| lg | `5-6` (20-24px) | Section spacing |
| xl | `8-10` (32-40px) | Page padding on desktop |

### Page Layout Spacing

```tsx
// Mobile: p-4 (16px)
// Desktop: px-10 py-8 (40px horizontal, 32px vertical)
className="p-4 lg:px-10 lg:py-8"

// Section spacing
className="space-y-6"

// Card content padding
className="p-4" // Standard
className="p-5" // Larger cards
```

---

## Components

### Buttons

**Variants:**
- `default` - Primary actions (green)
- `secondary` - Secondary actions (terracotta)
- `outline` - Tertiary actions
- `ghost` - Subtle actions
- `destructive` - Dangerous actions
- `success` - Positive confirmations

**Sizes:**
- `default` - Standard (h-10)
- `sm` - Small (h-9)
- `lg` - Large (h-12)
- `icon` - Icon only (h-10 w-10)

**Styling:**
- Rounded corners: `rounded-xl`
- Press effect on tap: `active:scale-[0.98]`
- Shadow on primary/secondary: `shadow-md`

```tsx
// Primary action
<Button>Save Changes</Button>

// Secondary action
<Button variant="outline">Cancel</Button>

// Destructive action
<Button variant="destructive">Delete</Button>

// Icon button
<Button variant="ghost" size="icon">
  <MessageCircle className="h-4 w-4" />
</Button>
```

### Cards

**Styling:**
- Rounded corners: `rounded-2xl`
- Subtle border: `border-border/50`
- Light shadow: `shadow-sm`
- Hover effect (desktop only): `card-hover` class

```tsx
<Card className="card-hover">
  <CardContent className="p-4">
    {/* Content */}
  </CardContent>
</Card>
```

### Inputs

**Styling:**
- Height: `h-11`
- Rounded corners: `rounded-xl`
- Border: `border-2`
- Focus state: Primary border with ring

```tsx
<Input
  placeholder="Search..."
  className="pl-11" // If has icon
/>
```

### Badges

**Variants:**
- `default` - Primary (solid green)
- `secondary` - Muted (light with colored text)
- `success` - Success state
- `warning` - Warning state
- `destructive` - Error/danger state
- `outline` - Bordered only

```tsx
// Category badge
<Badge variant="secondary">{category}</Badge>

// Status badge
<Badge variant="success">Active</Badge>
<Badge variant="warning">Expiring Soon</Badge>
<Badge variant="destructive">Expired</Badge>
```

### Icons

- Use Lucide React icons exclusively
- Standard size: `h-4 w-4` or `h-5 w-5`
- Color: Inherit from parent or use `text-muted-foreground`

```tsx
import { Store, Clock, MapPin } from "lucide-react";

<Store className="h-4 w-4" />
<Clock className="h-3 w-3 text-muted-foreground" />
```

---

## Layout Patterns

### Page Structure

```tsx
export default function PageName() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground">
          Page Title
        </h1>
        <p className="text-muted-foreground mt-1">
          Page description
        </p>
      </div>

      {/* Content */}
      <div>
        {/* Page content here */}
      </div>
    </div>
  );
}
```

### Loading States

Use skeleton loaders, NOT spinners:

```tsx
import { Skeleton, SkeletonCard } from "../components/ui/skeleton";

if (loading) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
```

### Grid Layouts

```tsx
// Stats grid
<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">

// Product/listing grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Two column layout
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
```

### Empty States

```tsx
<Card>
  <CardContent className="p-12 text-center">
    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
      <Package className="h-8 w-8 text-muted-foreground" />
    </div>
    <p className="text-muted-foreground mb-4">No items found</p>
    <Button asChild>
      <Link to="/create">Create First Item</Link>
    </Button>
  </CardContent>
</Card>
```

---

## Mobile Considerations

### Navigation

- **Mobile**: Bottom tab bar with 5 tabs (Home, Fridge, Market, Messages, Account)
- **Desktop**: Left sidebar with full navigation

### Touch Targets

- Minimum size: 44px x 44px
- Use `press-effect` class for tap feedback

```tsx
<Card className="card-hover press-effect">
```

### Safe Areas

For notched devices, use safe area classes:

```tsx
// Top safe area (for headers)
className="safe-area-top"

// Bottom safe area (for bottom nav)
className="safe-area-bottom"
```

### Scrollable Lists

Hide scrollbars on horizontal scrollable areas:

```tsx
<div className="flex gap-2 overflow-x-auto scrollbar-hide">
```

---

## Do's and Don'ts

### DO

- Use theme color variables (`bg-primary`, `text-muted-foreground`)
- Use `rounded-xl` or `rounded-2xl` for components
- Use skeleton loaders for loading states
- Use consistent spacing (`space-y-6` for sections)
- Keep mobile experience simple and touch-friendly
- Use semantic color meanings (success=green, warning=yellow, destructive=red)

### DON'T

- Don't use hardcoded colors (`bg-green-600`, `text-gray-500`)
- Don't add page transition animations (no `animate-fade-in`, `animate-slide-up`)
- Don't use spinners for loading (use skeletons)
- Don't create new components when existing ones work
- Don't use `rounded-md` or `rounded-lg` (use `rounded-xl` or `rounded-2xl`)
- Don't use small touch targets on mobile
- Don't add unnecessary hover effects or decorations

### Code Style

```tsx
// CORRECT
<Card className="card-hover">
  <CardContent className="p-4">
    <h3 className="font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground mt-1">{description}</p>
  </CardContent>
</Card>

// INCORRECT
<Card className="hover:shadow-lg transition-all duration-300 animate-fade-in">
  <CardContent className="p-4">
    <h3 className="font-semibold text-gray-900">{title}</h3>
    <p className="text-sm text-gray-500 mt-1">{description}</p>
  </CardContent>
</Card>
```

---

## Component Reference

### Available UI Components

Located in `frontend/src/components/ui/`:

| Component | File | Usage |
|-----------|------|-------|
| Button | `button.tsx` | All clickable actions |
| Card | `card.tsx` | Content containers |
| Input | `input.tsx` | Text inputs |
| Badge | `badge.tsx` | Status indicators, tags |
| Progress | `progress.tsx` | Progress bars |
| Skeleton | `skeleton.tsx` | Loading placeholders |
| Label | `label.tsx` | Form labels |

### Utility Classes

Defined in `frontend/src/index.css`:

| Class | Effect |
|-------|--------|
| `card-hover` | Subtle lift on hover (desktop only) |
| `press-effect` | Scale down on tap |
| `skeleton` | Shimmer loading animation |
| `scrollbar-hide` | Hide scrollbars |
| `safe-area-top` | Padding for notched devices (top) |
| `safe-area-bottom` | Padding for notched devices (bottom) |

---

## Quick Reference

### Common Patterns

```tsx
// Page header
<div>
  <h1 className="text-2xl lg:text-3xl font-bold text-foreground">Title</h1>
  <p className="text-muted-foreground mt-1">Description</p>
</div>

// Stat card with icon
<Card className="card-hover">
  <CardContent className="p-4">
    <div className="flex items-center gap-3">
      <div className="p-2.5 rounded-xl bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">Label</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </div>
  </CardContent>
</Card>

// List item with image
<Card className="card-hover press-effect">
  <CardContent className="p-4">
    <div className="flex gap-4">
      <div className="w-16 h-16 rounded-xl overflow-hidden bg-muted">
        <img src={url} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-foreground truncate">{title}</h3>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  </CardContent>
</Card>

// Filter/tab buttons
<div className="flex gap-2 overflow-x-auto scrollbar-hide">
  {options.map((option) => (
    <button
      key={option}
      onClick={() => setSelected(option)}
      className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
        selected === option
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-muted-foreground"
      }`}
    >
      {option}
    </button>
  ))}
</div>
```

---

*Last updated: January 2025*
