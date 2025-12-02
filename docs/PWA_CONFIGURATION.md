# PWA URL Configuration

The Zezamii Pass system uses a PWA (Progressive Web App) for displaying passes to end users. The base URL for this PWA is configurable to support different domains.

## Current Configuration

- **Development/Staging**: `https://zezamii-pass.vercel.app`
- **Future Production**: `https://pass.zezamii.com`

## How to Change the PWA URL

### Option 1: Environment Variable (Recommended)

Add or update the `NEXT_PUBLIC_PWA_BASE_URL` environment variable in your Vercel project settings:

\`\`\`bash
NEXT_PUBLIC_PWA_BASE_URL=https://pass.zezamii.com
\`\`\`

### Option 2: Local Development

Create a `.env.local` file in your project root:

\`\`\`bash
NEXT_PUBLIC_PWA_BASE_URL=http://localhost:3000
\`\`\`

## Where the PWA URL is Used

The PWA base URL is used in the following places:

1. **Pass URL Generation**: Creating links to individual passes
   - Format: `{PWA_BASE_URL}/{slug}`
   - Example: `https://pass.zezamii.com/hotel-room-101`

2. **Pass URLs with Lock Codes**: Sharing passes with embedded codes
   - Format: `{PWA_BASE_URL}/{slug}?code={lock_code}`
   - Example: `https://pass.zezamii.com/hotel-room-101?code=123456`

3. **QR Code Generation**: Encoding pass URLs in QR codes (future feature)

4. **Email Templates**: Including pass links in notification emails (future feature)

5. **API Responses**: Returning full URLs in API responses (future feature)

## Implementation

The configuration is centralized in `lib/config.ts`:

\`\`\`typescript
import { config, generatePassUrl, generatePassUrlWithCode } from '@/lib/config'

// Get the base URL
console.log(config.pwaBaseUrl)

// Generate a pass URL
const passUrl = generatePassUrl('hotel-room-101')
// Returns: https://pass.zezamii.com/hotel-room-101

// Generate a pass URL with code
const passUrlWithCode = generatePassUrlWithCode('hotel-room-101', '123456')
// Returns: https://pass.zezamii.com/hotel-room-101?code=123456
\`\`\`

## Migration Plan

When migrating from `zezamii-pass.vercel.app` to `pass.zezamii.com`:

1. Update the environment variable in Vercel project settings
2. Redeploy the application
3. Test all pass URLs to ensure they work correctly
4. Update any documentation or external references
5. Consider implementing redirects from the old domain (optional)

## Custom Domains

To use a custom domain:

1. Configure DNS settings to point to Vercel
2. Add the custom domain in Vercel project settings
3. Update the `NEXT_PUBLIC_PWA_BASE_URL` environment variable
4. Redeploy the application

## Security Considerations

- Always use HTTPS in production
- Validate URLs before generating passes
- Consider implementing URL expiration for temporary passes
