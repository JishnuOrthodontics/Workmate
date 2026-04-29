# Frontend Application

## Overview

The Workmate frontend is a Next.js application that provides the customer interface for the Rural Kerala Home Services Platform.

## Features

- Service browsing and booking
- Real-time worker matching
- Service tracking
- Payment processing
- User profile management

## Local Development

### Prerequisites

- Node.js 20+
- npm 10+

### Setup

```bash
# Navigate to frontend directory
cd frontend/app

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run export` - Export static site

## Project Structure

```
frontend/app/
├── src/
│   ├── app/              # Next.js app directory
│   │   ├── layout.tsx    # Root layout
│   │   ├── page.tsx      # Home page
│   │   └── globals.css   # Global styles
│   ├── components/       # React components
│   └── lib/             # Utility functions
├── public/              # Static assets
├── package.json         # Dependencies
└── next.config.mjs      # Next.js configuration
```

## Environment Variables

Create a `.env.local` file:

```bash
NEXT_PUBLIC_BACKEND_CONTEXT_PATH=http://localhost:3000
NEXT_PUBLIC_USE_EDGE_AUTH=false
```

## API Integration

The frontend communicates with backend services via REST APIs:

- **Auth**: N/A (Firebase)
- **Booking Service**: `http://localhost:3001/api/jobs`
- **Worker Service**: `http://localhost:3002/api/workers`
- **Payment Service**: `http://localhost:3003/api/payments`
- **Notification Service**: `http://localhost:3006/api/notifications`

## Styling

The application uses Tailwind CSS for styling:

- Responsive design
- Mobile-first approach
- Accessible components
- Consistent design system

## Deployment

The frontend is deployed to Cloudflare Pages:

```bash
# Build for production
npm run build

# Export static files
npm run export
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Accessibility

The application follows WCAG 2.1 guidelines:

- Semantic HTML
- ARIA labels where needed
- Keyboard navigation
- Screen reader support

## Performance

Optimized for rural connectivity:

- Code splitting
- Image optimization
- Lazy loading
- Minimal bundle size
- Offline-first PWA capabilities
