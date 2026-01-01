# RNDC Connect - Colombian Transport Management System

## Overview

RNDC Connect is a logistics platform designed for Colombian road transport companies to interact with the RNDC (Registro Nacional de Despacho de Carga) system maintained by the Ministry of Transport. The application enables fleet monitoring companies and transport operators to submit control point reports, retrieve manifests, and manage transportation compliance requirements.

The system handles:
- **User Authentication**: Login/registration system with session management
- **Monitoring Module**: Retrieves authorized cargo manifests from RNDC via SOAP web services
- **Tracking Module**: Reports arrival/departure times at control points
- **Bulk Import**: Processes Excel files for batch submission of control point data
- **Settings Management**: User profile, RNDC credentials and company information

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript
- Vite for build tooling and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- Tailwind CSS v4 with shadcn/ui component library

**Design Patterns:**
- Component-based architecture with reusable UI components
- Custom hooks for state management (`useSettings`, `useToast`, `useMobile`, `useAuth`)
- AuthProvider context for session management with protected routes
- Route-based code splitting with dedicated page components

**Key Features:**
- Real-time XML preview generation for RNDC requests
- Excel file parsing using XLSX library
- Responsive design with mobile-first approach
- Dark mode support via CSS variables

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Node.js HTTP server with optional WebSocket support
- PostgreSQL database via Drizzle ORM
- ESBuild for production bundling

**API Design:**
- RESTful endpoints under `/api` namespace
- Authentication endpoints: `/api/auth/login`, `/api/auth/logout`, `/api/auth/register`, `/api/auth/me`, `/api/auth/profile`, `/api/auth/password`
- Session-based authentication with bcrypt password hashing
- SOAP client for RNDC web service integration
- Batch processing system for bulk submissions
- XML parsing using fast-xml-parser

**Data Layer:**
- Database abstraction through storage interface (`IStorage`)
- Three main entities: Users, RNDC Batches, RNDC Submissions
- Drizzle ORM for type-safe database queries
- Schema-first approach with Zod validation

**Key Architectural Decisions:**

1. **Monorepo Structure**: Client and server code coexist with shared schema definitions in `shared/` directory, enabling type sharing across stack boundaries.

2. **Database Schema Design**: 
   - `rndcBatches` table tracks batch submission metadata (total, success, error counts)
   - `rndcSubmissions` table stores individual control point reports with XML request/response
   - Batch-submission relationship enables progress tracking and retry logic

3. **RNDC Integration**: 
   - SOAP envelope wrapper around XML requests
   - Configurable 5-minute polling interval constraint
   - Support for three query types: new manifests, all manifests (24h), specific manifest lookup

4. **Build Strategy**: 
   - Vite builds client into `dist/public`
   - ESBuild bundles server with allowlisted dependencies
   - Static file serving falls through to index.html for SPA routing

### External Dependencies

**RNDC Web Service:**
- SOAP endpoint: `https://rndc.mintransporte.gov.co/MenuPrincipal/tablogin/loginWebService.asmx`
- Authentication via username/password in XML body
- Process types: Type 9 (monitoring), Process ID 4
- Rate limiting: Minimum 5 minutes between requests

**Database:**
- PostgreSQL (configured via DATABASE_URL environment variable)
- Drizzle Kit for schema migrations to `./migrations` directory
- Connection pooling via `pg` library

**Third-Party Services:**
- Replit-specific plugins for development (cartographer, dev-banner, runtime-error-modal)
- Google Fonts (Inter, JetBrains Mono, Rajdhani)

**NPM Dependencies:**
- UI: Radix UI primitives (20+ components), Lucide icons
- Data: Drizzle ORM, Zod validation, date-fns
- Server: Express, connect-pg-simple for sessions
- Build: Vite, ESBuild, TypeScript

**Data Storage:**
- Local storage for user settings (credentials, company NIT)
- Session management via connect-pg-simple with PostgreSQL backend
- File uploads handled by multer (listed in allowlist but not currently implemented)