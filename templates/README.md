# Tenant Configuration Templates

This directory contains reference documentation for setting up new tenants in the Zezamii Pass system.

## Schema Definition

The complete schema is defined in TypeScript at `lib/schemas/tenant-config.ts` using Zod validation. This provides:
- Runtime validation
- Type safety
- Automatic TypeScript types
- Better error messages

## Usage

1. Create your tenant configuration as JSON (manually or exported from another system)
2. Upload via the Admin Portal at `/dashboard/config-upload`
3. The system validates the configuration using Zod schemas
4. Download as JSON, Excel, or SQL for database setup

## Key Sections

### Organisation
The top-level tenant/company information including branding, contact details, and timezone.

### Sites
Physical locations where access control is deployed (minimum 1 required).

### Buildings & Floors
Optional hierarchy for organising devices within sites.

### Devices
The actual access control hardware - locks, gates, turnstiles, etc. (minimum 1 required).

### Pass Types
The different types of passes available for purchase - day pass, week pass, etc. (minimum 1 required).

### Access Point Slugs
Human-readable URLs for each entry point (e.g., `/p/main-entrance`).

### Integrations
Third-party system connections (Rooms Event Hub, Stripe, etc.).

## Validation

The configuration must pass:
- Zod schema validation (data types, required fields, formats)
- Relationship validation (all foreign keys reference valid records)
- Uniqueness validation (slugs must be unique)

## File Formats

The portal supports both JSON and Excel formats:

### JSON Format
Standard JSON with nested objects and arrays matching the schema.

### Excel Format
- One sheet per data type (Organisation, Sites, Buildings, Floors, Devices, PassTypes, AccesspointSlugs, Integrations)
- Column names must match JSON field names exactly
- Empty cells treated as null/undefined
- Boolean values: TRUE/FALSE or 1/0

See the Config Upload page for real-time validation feedback and format examples.
