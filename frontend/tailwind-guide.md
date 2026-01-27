# How to Get Away with Tailwind CSS & shadcn/ui

## Table of Contents
1. [Getting Started](#getting-started)
2. [Eco Sage Color Theme](#eco-sage-color-theme)
3. [Tailwind Basics](#tailwind-basics)
4. [Common Patterns](#common-patterns)
5. [shadcn/ui Components](#shadcnui-components)
6. [Responsive Design](#responsive-design)
7. [Dark Mode](#dark-mode)
8. [Best Practices](#best-practices)

---

## Getting Started

### What is Tailwind CSS?
Tailwind is a utility-first CSS framework. Instead of writing custom CSS, you use pre-defined classes directly in your JSX/HTML.

**Example:**
```jsx
// ❌ Old way (custom CSS)
<div className="my-custom-button">Click me</div>
// In CSS file: .my-custom-button { background: green; padding: 8px; ... }

// ✅ Tailwind way
<div className="bg-primary px-4 py-2 rounded">Click me</div>
```

### What is shadcn/ui?
shadcn/ui provides pre-built, accessible React components that use Tailwind CSS. Components are copied into your project (not installed as a package), so you own and can customize them.

### Resources
- **Tailwind Docs**: https://tailwindcss.com/docs
- **shadcn/ui Docs**: https://ui.shadcn.com
- **VS Code Extension**: Install "Tailwind CSS IntelliSense" for autocomplete

---

## Eco Sage Color Theme

Our custom color palette is defined in `tailwind.config.js` and can be used throughout the app.

### Primary Colors (Green Sage)
```jsx
// Brand green colors
<div className="bg-primary">         // #5F7A61 - Main brand color
<div className="bg-primary-dark">    // #4A5F4C - Darker variant
<div className="bg-primary-light">   // #8FA491 - Lighter variant
<div className="text-primary">       // Green text
<div className="text-primary-foreground"> // #F5F5F5 - Text on primary background
```

**Visual Reference:**
- Primary: `#5F7A61` 🟢
- Primary Dark: `#4A5F4C` 🟢
- Primary Light: `#8FA491` 🟢

### Secondary Colors (Terracotta/Orange)
```jsx
<div className="bg-secondary">       // #C17B5C - Secondary brand color
<div className="bg-secondary-dark">  // #A86548 - Darker variant
<div className="bg-secondary-light"> // #D9A088 - Lighter variant
<div className="text-secondary">     // Orange text
<div className="text-secondary-foreground"> // #FFFFFF - Text on secondary background
```

**Visual Reference:**
- Secondary: `#C17B5C` 🟠
- Secondary Dark: `#A86548` 🟠
- Secondary Light: `#D9A088` 🟠

### Accent Color (Purple)
```jsx
<div className="bg-accent">          // #6B4E71 - Accent color
<div className="text-accent">        // Purple text
<div className="text-accent-foreground"> // #FFFFFF - Text on accent background
```

**Visual Reference:**
- Accent: `#6B4E71` 🟣

### Semantic Colors
```jsx
// Success (Green)
<div className="bg-success">         // #7B9E7E - Success states
<div className="text-success">       // Success text

// Warning (Yellow/Orange)
<div className="bg-warning">         // #E8A547 - Warning states
<div className="text-warning">       // Warning text

// Danger/Error (Red)
<div className="bg-destructive">     // #C85C5C - Error states
<div className="text-destructive">   // Error text
```

**Visual Reference:**
- Success: `#7B9E7E` 🟢
- Warning: `#E8A547` 🟡
- Destructive: `#C85C5C` 🔴

### Background Colors
```jsx
// Light mode backgrounds
<div className="bg-background">      // #FAF9F6 - Page background (light cream)
<div className="bg-card">            // #FFFFFF - Card/surface background

// Dark mode backgrounds
<div className="bg-background dark:bg-background-dark"> // #2C2C2C
<div className="bg-card dark:bg-card-dark">            // #3A3A3A
```

**Visual Reference:**
- Background Light: `#FAF9F6` ⬜
- Background Dark: `#2C2C2C` ⬛
- Card Light: `#FFFFFF` ⬜
- Card Dark: `#3A3A3A` ⬛

### Text Colors
```jsx
<p className="text-foreground">           // #1F1F1F - Primary text (dark)
<p className="text-foreground-secondary"> // #4A4A4A - Secondary text (gray)
<p className="text-foreground-muted">     // #B8B8B8 - Muted text (light gray)
<p className="text-foreground-inverse">   // #F5F5F5 - Light text for dark backgrounds
<p className="text-muted-foreground">     // Muted/subtle text
```

**Visual Reference:**
- Foreground: `#1F1F1F` ⬛
- Foreground Secondary: `#4A4A4A` ⬛
- Foreground Muted: `#B8B8B8` ⬜
- Foreground Inverse: `#F5F5F5` ⬜

### Border & Input Colors
```jsx
<div className="border border-border">    // #E0E0E0 - Default borders
<input className="border-input">          // #E0E0E0 - Input borders
<div className="ring-2 ring-ring">        // #5F7A61 - Focus rings (primary color)
```

**Visual Reference:**
- Border/Input: `#E0E0E0` ⬜
- Ring: `#5F7A61` 🟢

### Complete Color Reference Table

| Name | Hex | Usage |
|------|-----|-------|
| Primary | `#5F7A61` | Main brand color, primary buttons, headers |
| Primary Dark | `#4A5F4C` | Hover states for primary |
| Primary Light | `#8FA491` | Subtle backgrounds, light accents |
| Secondary | `#C17B5C` | Secondary actions, warm accents |
| Secondary Dark | `#A86548` | Hover states for secondary |
| Secondary Light | `#D9A088` | Subtle secondary backgrounds |
| Accent | `#6B4E71` | Special highlights, badges |
| Success | `#7B9E7E` | Success messages, fresh food indicators |
| Warning | `#E8A547` | Warnings, expiring soon indicators |
| Destructive | `#C85C5C` | Errors, expired food, delete actions |
| Background | `#FAF9F6` | Page background (light) |
| Background Dark | `#2C2C2C` | Page background (dark mode) |
| Card | `#FFFFFF` | Cards, modals (light) |
| Card Dark | `#3A3A3A` | Cards, modals (dark mode) |
| Foreground | `#1F1F1F` | Primary text |
| Foreground Secondary | `#4A4A4A` | Secondary text |
| Foreground Muted | `#B8B8B8` | Muted text |
| Border | `#E0E0E0` | Borders, dividers |

---

## Tailwind Basics

### Spacing
Tailwind uses a numeric scale where each unit = 0.25rem (4px)

```jsx
// Padding (p)
<div className="p-4">        // padding: 1rem (16px) all sides
<div className="px-4 py-2">  // padding: 1rem horizontal, 0.5rem vertical
<div className="pt-2 pb-4">  // padding top 8px, bottom 16px

// Margin (m)
<div className="m-4">        // margin: 1rem all sides
<div className="mx-auto">    // margin horizontal auto (centers element)
<div className="mt-8 mb-4">  // margin top 32px, bottom 16px

// Gap (for flex/grid children)
<div className="flex gap-4">      // 16px gap between children
<div className="grid gap-x-2 gap-y-4"> // 8px horizontal, 16px vertical

// Space (between children)
<div className="space-y-4">  // 16px vertical space between children
<div className="space-x-2">  // 8px horizontal space between children
```

**Common spacing values:**
- `0` = 0px
- `1` = 4px
- `2` = 8px
- `3` = 12px
- `4` = 16px
- `6` = 24px
- `8` = 32px
- `12` = 48px
- `16` = 64px

### Layout

#### Flexbox
```jsx
// Basic flex container
<div className="flex">                    // display: flex
<div className="flex flex-col">           // flex-direction: column
<div className="flex flex-row">           // flex-direction: row (default)

// Alignment
<div className="flex items-center">       // align-items: center (vertical)
<div className="flex justify-between">    // justify-content: space-between (horizontal)
<div className="flex justify-center">     // justify-content: center
<div className="flex items-center justify-center"> // Center both ways

// Common patterns
<div className="flex items-center gap-2"> // Horizontal items with gap
<div className="flex flex-col space-y-4"> // Vertical items with space
<div className="flex justify-between items-center"> // Spread items, vertically centered
```

#### Grid
```jsx
<div className="grid grid-cols-2 gap-4">      // 2 columns with gap
<div className="grid grid-cols-3 gap-4">      // 3 columns with gap
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  // 1 column mobile, 2 tablet, 3 desktop
</div>
```

### Sizing
```jsx
// Width
<div className="w-full">      // width: 100%
<div className="w-1/2">       // width: 50%
<div className="w-64">        // width: 16rem (256px)
<div className="max-w-md">    // max-width: 28rem (448px)
<div className="max-w-screen-lg"> // max-width: 1024px

// Height
<div className="h-full">      // height: 100%
<div className="h-screen">    // height: 100vh
<div className="h-64">        // height: 16rem (256px)
<div className="min-h-screen"> // min-height: 100vh
```

### Typography
```jsx
// Font sizes
<h1 className="text-4xl">     // 2.25rem (36px)
<h2 className="text-3xl">     // 1.875rem (30px)
<h3 className="text-2xl">     // 1.5rem (24px)
<h4 className="text-xl">      // 1.25rem (20px)
<p className="text-base">     // 1rem (16px)
<small className="text-sm">   // 0.875rem (14px)
<span className="text-xs">    // 0.75rem (12px)

// Font weights
<p className="font-light">    // 300
<p className="font-normal">   // 400
<p className="font-medium">   // 500
<p className="font-semibold"> // 600
<p className="font-bold">     // 700

// Text alignment
<p className="text-left">     // text-align: left
<p className="text-center">   // text-align: center
<p className="text-right">    // text-align: right

// Other
<p className="uppercase">     // TEXT TRANSFORM
<p className="capitalize">    // First Letter Capital
<p className="truncate">      // Truncate with ellipsis...
<p className="line-clamp-2">  // Limit to 2 lines with ellipsis
```

### Borders & Rounded Corners
```jsx
// Borders
<div className="border">              // 1px border all sides
<div className="border-2">            // 2px border
<div className="border-t border-b">   // top and bottom only
<div className="border border-primary"> // border with primary color

// Rounded corners
<div className="rounded">      // border-radius: 0.25rem
<div className="rounded-md">   // border-radius: 0.375rem
<div className="rounded-lg">   // border-radius: 0.5rem
<div className="rounded-xl">   // border-radius: 0.75rem
<div className="rounded-full">  // border-radius: 9999px (circle/pill)
<div className="rounded-t-lg">  // Only top corners
```

### Shadows
```jsx
<div className="shadow-sm">   // Small shadow
<div className="shadow">      // Default shadow
<div className="shadow-md">   // Medium shadow
<div className="shadow-lg">   // Large shadow
<div className="shadow-xl">   // Extra large shadow
```

### Interactive States
```jsx
// Hover
<button className="bg-primary hover:bg-primary-dark">
  Hover me
</button>

// Focus
<input className="border-input focus:ring-2 focus:ring-primary" />

// Active (pressed)
<button className="bg-primary active:bg-primary-dark">
  Click me
</button>

// Disabled
<button className="bg-primary disabled:opacity-50 disabled:cursor-not-allowed" disabled>
  Disabled
</button>

// Combination
<button className="bg-primary hover:bg-primary-dark focus:ring-2 focus:ring-primary transition-colors">
  Button
</button>
```

### Transitions
```jsx
<div className="transition">                    // transition all properties
<div className="transition-colors">             // only colors
<div className="transition-transform">          // only transforms
<div className="duration-300">                  // 300ms duration
<div className="ease-in-out">                   // easing function

// Common pattern
<button className="bg-primary hover:bg-primary-dark transition-colors duration-200">
  Smooth color transition
</button>
```

---

## Common Patterns

### Button Styles

#### Primary Button
```jsx
<button className="bg-primary hover:bg-primary-dark text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
  Primary Action
</button>
```

#### Secondary Button
```jsx
<button className="bg-secondary hover:bg-secondary-dark text-secondary-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
  Secondary Action
</button>
```

#### Outline Button
```jsx
<button className="border-2 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
  Outline Button
</button>
```

#### Destructive Button
```jsx
<button className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold py-2 px-4 rounded-lg transition-colors">
  Delete
</button>
```

### Card Components

#### Basic Card
```jsx
<div className="bg-card rounded-lg shadow-md p-6">
  <h3 className="text-xl font-bold mb-2">Card Title</h3>
  <p className="text-foreground-secondary">Card content goes here</p>
</div>
```

#### Card with Header and Footer
```jsx
<div className="bg-card rounded-lg shadow-md overflow-hidden">
  {/* Header */}
  <div className="bg-primary text-primary-foreground px-6 py-4">
    <h3 className="text-xl font-bold">Card Title</h3>
  </div>
  
  {/* Body */}
  <div className="p-6">
    <p className="text-foreground-secondary">Card content</p>
  </div>
  
  {/* Footer */}
  <div className="bg-muted px-6 py-4 flex justify-end gap-2">
    <button className="px-4 py-2 rounded">Cancel</button>
    <button className="bg-primary text-primary-foreground px-4 py-2 rounded">
      Save
    </button>
  </div>
</div>
```

### Food Item Cards (EcoPlate Specific)

#### Fresh Food Card
```jsx
<div className="bg-card rounded-lg shadow-md p-4 border-l-4 border-success">
  <div className="flex justify-between items-start mb-2">
    <h4 className="font-semibold text-foreground">Tomatoes</h4>
    <span className="text-xs bg-success text-success-foreground px-2 py-1 rounded-full">
      Fresh
    </span>
  </div>
  <p className="text-sm text-foreground-secondary">Expires in 7 days</p>
</div>
```

#### Expiring Soon Card
```jsx
<div className="bg-card rounded-lg shadow-md p-4 border-l-4 border-warning">
  <div className="flex justify-between items-start mb-2">
    <h4 className="font-semibold text-foreground">Milk</h4>
    <span className="text-xs bg-warning text-warning-foreground px-2 py-1 rounded-full">
      Expiring Soon
    </span>
  </div>
  <p className="text-sm text-foreground-secondary">Expires in 2 days</p>
</div>
```

#### Expired Card
```jsx
<div className="bg-card rounded-lg shadow-md p-4 border-l-4 border-destructive opacity-75">
  <div className="flex justify-between items-start mb-2">
    <h4 className="font-semibold text-foreground">Lettuce</h4>
    <span className="text-xs bg-destructive text-destructive-foreground px-2 py-1 rounded-full">
      Expired
    </span>
  </div>
  <p className="text-sm text-foreground-secondary">Expired 1 day ago</p>
</div>
```

### Form Inputs

#### Text Input
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-foreground">
    Email
  </label>
  <input
    type="email"
    className="w-full px-3 py-2 border border-input rounded-md focus:ring-2 focus:ring-primary focus:border-primary"
    placeholder="you@example.com"
  />
</div>
```

#### Input with Error
```jsx
<div className="space-y-2">
  <label className="block text-sm font-medium text-foreground">
    Email
  </label>
  <input
    type="email"
    className="w-full px-3 py-2 border border-destructive rounded-md focus:ring-2 focus:ring-destructive"
    placeholder="you@example.com"
  />
  <p className="text-sm text-destructive">Please enter a valid email</p>
</div>
```

### Navigation

#### Navbar
```jsx
<nav className="bg-primary text-primary-foreground shadow-md">
  <div className="container mx-auto px-4 py-3 flex justify-between items-center">
    <div className="text-xl font-bold">EcoPlate</div>
    <div className="flex gap-4">
      <a href="#" className="hover:text-primary-light transition-colors">
        Dashboard
      </a>
      <a href="#" className="hover:text-primary-light transition-colors">
        My Fridge
      </a>
      <a href="#" className="hover:text-primary-light transition-colors">
        Marketplace
      </a>
    </div>
  </div>
</nav>
```

### Lists

#### Simple List
```jsx
<ul className="space-y-2">
  <li className="flex items-center gap-2">
    <span className="w-2 h-2 bg-primary rounded-full"></span>
    <span>List item 1</span>
  </li>
  <li className="flex items-center gap-2">
    <span className="w-2 h-2 bg-primary rounded-full"></span>
    <span>List item 2</span>
  </li>
</ul>
```

#### Divided List
```jsx
<div className="divide-y divide-border">
  <div className="py-3">List item 1</div>
  <div className="py-3">List item 2</div>
  <div className="py-3">List item 3</div>
</div>
```

### Badges & Tags

```jsx
{/* Status badges */}
<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-success text-success-foreground">
  Active
</span>

<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-warning text-warning-foreground">
  Pending
</span>

<span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-destructive text-destructive-foreground">
  Expired
</span>

{/* Count badge */}
<div className="relative">
  <button className="p-2">
    🔔
  </button>
  <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center">
    3
  </span>
</div>
```

---

## shadcn/ui Components

### Installing Components

Add new components with:
```bash
npx shadcn@latest add [component-name]
```

Example:
```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add select
npx shadcn@latest add tabs
npx shadcn@latest add toast
```

### Button Component

```jsx
import { Button } from "@/components/ui/button"

// Variants
<Button variant="default">Default</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">📱</Button>

// With custom className
<Button className="bg-accent hover:bg-accent/90">
  Custom Color
</Button>
```

### Card Component

```jsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
  <CardFooter className="flex justify-between">
    <Button variant="outline">Cancel</Button>
    <Button>Save</Button>
  </CardFooter>
</Card>
```

### Dialog Component

```jsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Are you sure?</DialogTitle>
      <DialogDescription>
        This action cannot be undone.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button variant="destructive">Delete</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### Input & Label

```jsx
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input 
    id="email" 
    type="email" 
    placeholder="you@example.com" 
  />
</div>
```

### Form Example

```jsx
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

<Card className="w-96">
  <CardHeader>
    <CardTitle>Add Food Item</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="space-y-2">
      <Label htmlFor="name">Food Name</Label>
      <Input id="name" placeholder="e.g., Tomatoes" />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="expiry">Expiry Date</Label>
      <Input id="expiry" type="date" />
    </div>
    
    <div className="space-y-2">
      <Label htmlFor="quantity">Quantity</Label>
      <Input id="quantity" type="number" placeholder="1" />
    </div>
    
    <Button className="w-full">Add Item</Button>
  </CardContent>
</Card>
```

---

## Responsive Design

Tailwind uses mobile-first breakpoints:
- `sm:` - 640px and up
- `md:` - 768px and up
- `lg:` - 1024px and up
- `xl:` - 1280px and up
- `2xl:` - 1536px and up

### Examples

```jsx
// Text size responsive
<h1 className="text-2xl md:text-4xl lg:text-5xl">
  Responsive Heading
</h1>

// Grid columns responsive
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 column mobile, 2 tablet, 3 desktop */}
</div>

// Hide/show based on screen size
<div className="hidden md:block">
  Only visible on tablet and up
</div>

<div className="block md:hidden">
  Only visible on mobile
</div>

// Padding responsive
<div className="p-4 md:p-8 lg:p-12">
  More padding on larger screens
</div>

// Flex direction responsive
<div className="flex flex-col md:flex-row gap-4">
  {/* Stack vertically on mobile, horizontally on tablet+ */}
</div>
```

### Complete Responsive Card Example

```jsx
<div className="w-full px-4 md:px-8 lg:px-12">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
    <Card>
      <CardContent className="p-4 md:p-6">
        <h3 className="text-lg md:text-xl font-bold mb-2">
          Responsive Card
        </h3>
        <p className="text-sm md:text-base text-foreground-secondary">
          This card adapts to screen size
        </p>
      </CardContent>
    </Card>
  </div>
</div>
```

---

## Dark Mode

Dark mode is enabled with the `dark:` prefix. Add the `dark` class to the root element to activate.

### Toggle Dark Mode

```jsx
// In your app root or layout component
import { useState } from 'react'

function App() {
  const [isDark, setIsDark] = useState(false)
  
  return (
    <div className={isDark ? 'dark' : ''}>
      <div className="min-h-screen bg-background text-foreground">
        <button 
          onClick={() => setIsDark(!isDark)}
          className="p-2 rounded bg-primary text-primary-foreground"
        >
          Toggle Dark Mode
        </button>
        
        {/* Your app content */}
      </div>
    </div>
  )
}
```

### Dark Mode Examples

```jsx
// Background that changes in dark mode
<div className="bg-background dark:bg-background-dark">
  Content
</div>

// Text that changes in dark mode
<p className="text-foreground dark:text-foreground-inverse">
  This text adapts to dark mode
</p>

// Card with dark mode
<Card className="bg-card dark:bg-card-dark">
  <CardContent>
    <p className="text-foreground dark:text-foreground-inverse">
      Card content
    </p>
  </CardContent>
</Card>

// Border that changes
<div className="border border-border dark:border-gray-700">
  Content with border
</div>
```

---

## Best Practices

### 1. Use Semantic Color Names
```jsx
// ✅ Good - semantic meaning
<Button variant="destructive">Delete</Button>
<div className="bg-success">Success message</div>

// ❌ Avoid - hardcoded colors
<Button className="bg-red-500">Delete</Button>
<div className="bg-green-500">Success message</div>
```

### 2. Consistent Spacing
Use the spacing scale consistently throughout your app:
```jsx
// ✅ Good - consistent spacing (4, 8, 16, 24, 32)
<div className="space-y-4">
  <div className="p-4">...</div>
  <div className="p-6">...</div>
</div>

// ❌ Avoid - random spacing
<div className="space-y-3">
  <div className="p-5">...</div>
  <div className="p-7">...</div>
</div>
```

### 3. Component Composition
Build reusable components:
```jsx
// ✅ Good - reusable component
function FoodCard({ name, expiryDays, status }) {
  const statusColors = {
    fresh: 'border-success bg-success',
    'expiring-soon': 'border-warning bg-warning',
    expired: 'border-destructive bg-destructive',
  }
  
  return (
    <Card className={`border-l-4 ${statusColors[status]}`}>
      <CardContent className="p-4">
        <h4 className="font-semibold">{name}</h4>
        <p className="text-sm text-foreground-secondary">
          {expiryDays} days
        </p>
      </CardContent>
    </Card>
  )
}

// Usage
<FoodCard name="Tomatoes" expiryDays={7} status="fresh" />
```

### 4. Use the `cn()` Helper
The `cn()` utility from `@/lib/utils` helps combine classes:
```jsx
import { cn } from "@/lib/utils"

function Button({ className, variant = "default", ...props }) {
  return (
    <button
      className={cn(
        "px-4 py-2 rounded font-semibold transition-colors",
        variant === "primary" && "bg-primary text-primary-foreground",
        variant === "secondary" && "bg-secondary text-secondary-foreground",
        className // Allow custom classes to override
      )}
      {...props}
    />
  )
}
```

### 5. Accessibility
```jsx
// ✅ Good - accessible
<button
  className="bg-primary text-primary-foreground"
  aria-label="Add to cart"
>
  Add
</button>

<img 
  src="food.jpg" 
  alt="Fresh tomatoes" 
  className="rounded-lg"
/>

// Use semantic HTML
<nav>...</nav>
<main>...</main>
<footer>...</footer>
```

### 6. Performance
```jsx
// ✅ Good - conditional classes
<div className={isActive ? "bg-primary" : "bg-secondary"}>

// ❌ Avoid - dynamic class generation (breaks PurgeCSS)
<div className={`bg-${color}-500`}>  // Don't do this!
```

### 7. Group Related Elements
```jsx
// ✅ Good - organized spacing
<div className="space-y-6">
  <section className="space-y-4">
    <h2 className="text-2xl font-bold">Section 1</h2>
    <div className="space-y-2">
      <p>Paragraph 1</p>
      <p>Paragraph 2</p>
    </div>
  </section>
  
  <section className="space-y-4">
    <h2 className="text-2xl font-bold">Section 2</h2>
    <div className="space-y-2">
      <p>Paragraph 3</p>
      <p>Paragraph 4</p>
    </div>
  </section>
</div>
```

---

## Quick Reference Cheatsheet

### Colors
- `bg-primary` - Primary background
- `bg-secondary` - Secondary background
- `bg-success` - Success state
- `bg-warning` - Warning state
- `bg-destructive` - Error/delete
- `text-foreground` - Primary text
- `text-muted-foreground` - Muted text

### Spacing
- `p-4` - Padding 16px
- `m-4` - Margin 16px
- `space-y-4` - Vertical space between children
- `gap-4` - Gap in flex/grid

### Layout
- `flex items-center justify-between`
- `grid grid-cols-3 gap-4`
- `container mx-auto`

### Typography
- `text-xl font-bold` - Large bold text
- `text-sm text-muted-foreground` - Small muted text

### Borders & Shadows
- `rounded-lg` - Rounded corners
- `border border-border` - Border
- `shadow-md` - Medium shadow

### Interactive
- `hover:bg-primary-dark`
- `focus:ring-2 focus:ring-primary`
- `transition-colors`

---

## Getting Help

1. **Tailwind Docs**: https://tailwindcss.com/docs - Search for any class
2. **shadcn/ui Docs**: https://ui.shadcn.com - Component examples
3. **VS Code Extension**: Install "Tailwind CSS IntelliSense" for autocomplete
4. **Ask the team**: Share this guide and ask questions in team chat

---

## Examples Repository

Check `src/components/ui/` for shadcn component examples that you can copy and customize.