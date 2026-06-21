# Clinic Branding & Customization Guide

## Overview

The SSMC EMR system now supports full branding customization, allowing each clinic to customize their logo and color theme to match their brand identity. This makes the system look unique for each clinic tenant.

---

## Features

### ✅ What Can Be Customized

1. **Clinic Logo** - Upload your clinic's logo (displays in sidebar)
2. **Primary Color** - Main brand color (buttons, active states, headers)
3. **Secondary Color** - Supporting color (success states, accents)
4. **Accent Color** - Highlight color (warnings, special elements)
5. **Font Family** - Choose from 6 professional fonts

### ✨ Dynamic Theme Application

- Colors apply **instantly** throughout the entire application
- Logo displays in the sidebar header
- Settings persist across sessions
- Each clinic tenant has independent branding

---

## How to Customize Your Clinic Branding

### Step 1: Access Settings (Admin Only)

1. Login as an **Admin** user
   - Email: `admin@hospital.com`
   - Password: `Admin@123`

2. Click **Settings** in the sidebar (bottom left, above Logout)

3. You'll see the **Clinic Settings** page

### Step 2: Upload Your Logo

**Option A: Upload Logo (Recommended)**
1. Upload your logo to a hosting service:
   - **Imgur**: https://imgur.com (Free)
   - **Cloudinary**: https://cloudinary.com (Free tier)
   - **Your own server**: Upload to your website

2. Copy the direct image URL (must end in .png, .jpg, .svg, etc.)

3. Paste the URL in the **Clinic Logo URL** field

4. Preview will show below the input

**Example URLs**:
```
https://i.imgur.com/abc123.png
https://res.cloudinary.com/demo/image/upload/v1/logo.png
https://yourwebsite.com/assets/logo.svg
```

**Option B: Use Base64** (Not Recommended)
- You can use a base64-encoded image URL
- Only for small logos (< 50KB)

### Step 3: Choose Your Color Theme

**Method 1: Use Color Pickers**
1. Click the colored square next to each color field
2. Pick your desired color from the picker
3. The hex code updates automatically

**Method 2: Enter Hex Codes**
1. Type hex color codes directly: `#3b82f6`
2. Must be in format: `#` followed by 6 characters (0-9, A-F)

**Method 3: Use Presets**
- Scroll down to **Color Presets**
- Click a preset to apply those colors instantly
- Presets: Default (Blue), Purple, Ocean, Nature

### Step 4: Select Font Family

Choose from professional fonts:
- **Inter** (Default - Modern, clean)
- **System UI** (Native OS font)
- **Arial** (Classic, professional)
- **Helvetica** (Swiss, elegant)
- **Georgia** (Serif, traditional)
- **Times New Roman** (Formal)

### Step 5: Save Changes

1. Click **Save Changes** button
2. Success message appears
3. **Refresh the page** to see changes applied

---

## Technical Details

### Database Schema

New fields added to `tenants` table:

```sql
logoUrl        String?
primaryColor   String  @default("#3b82f6")  -- Blue
secondaryColor String  @default("#10b981")  -- Green
accentColor    String  @default("#f59e0b")  -- Amber
fontFamily     String  @default("Inter")
```

### API Endpoints

**GET /api/branding** (Authenticated)
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/branding
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "27410ce7-8f90-435f-854c-db97ae26234e",
    "name": "St. Stephen Hospital",
    "clinicName": "St. Stephen Medical Center",
    "logoUrl": "https://i.imgur.com/logo.png",
    "primaryColor": "#3b82f6",
    "secondaryColor": "#10b981",
    "accentColor": "#f59e0b",
    "fontFamily": "Inter"
  }
}
```

**PUT /api/branding** (Admin Only)
```bash
curl -X PUT \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "logoUrl": "https://i.imgur.com/logo.png",
    "primaryColor": "#8b5cf6",
    "secondaryColor": "#ec4899",
    "accentColor": "#f43f5e"
  }' \
  http://localhost:3000/api/branding
```

**POST /api/branding/upload-logo** (Admin Only)
```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "logoUrl": "https://i.imgur.com/logo.png"
  }' \
  http://localhost:3000/api/branding/upload-logo
```

###Frontend Implementation

**Theme Application**:
- Loads branding on app startup
- Applies CSS custom properties
- Updates dynamically without page refresh (in Settings page)
- Persists across sessions

**Files Created**:
```
Backend:
  prisma/schema.prisma (updated Tenant model)
  src/backend/application/dtos/tenant/UpdateBranding.dto.ts
  src/backend/application/use-cases/tenant/get-branding.use-case.ts
  src/backend/application/use-cases/tenant/update-branding.use-case.ts
  src/backend/presentation/controllers/branding.controller.ts
  src/backend/presentation/routes/branding.routes.ts
  src/backend/server.ts (registered routes)

Frontend:
  src/frontend/pages/SettingsPage.tsx
  src/frontend/utils/theme.ts
  src/frontend/components/layout/MainLayout.tsx (updated)
  src/frontend/App.tsx (added /settings route)
```

---

## Common Use Cases

### Use Case 1: Multi-Clinic SaaS

**Scenario**: You're hosting multiple clinics, each needs their own branding

**Solution**:
1. Each clinic is a separate tenant
2. Admin from each clinic customizes their branding
3. Patients see their clinic's unique branding
4. Complete brand isolation between clinics

### Use Case 2: Hospital Chain

**Scenario**: Multiple branches of the same hospital chain

**Solution**:
1. Use same primary colors across all branches
2. Different logos for each branch
3. Maintains brand consistency while showing location identity

### Use Case 3: Private Practice

**Scenario**: Single doctor wants their practice branding

**Solution**:
1. Upload practice logo
2. Match colors to business cards/website
3. Professional, branded patient experience

---

## Color Scheme Examples

### Healthcare (Professional Blue/Green)
```
Primary:   #2563eb  (Blue)
Secondary: #059669  (Green)
Accent:    #0891b2  (Cyan)
```

### Wellness (Calming Purple/Pink)
```
Primary:   #8b5cf6  (Purple)
Secondary: #ec4899  (Pink)
Accent:    #f43f5e  (Rose)
```

### Pediatrics (Bright & Friendly)
```
Primary:   #0ea5e9  (Sky Blue)
Secondary: #f59e0b  (Amber)
Accent:    #10b981  (Green)
```

### Dental (Clean & Modern)
```
Primary:   #0284c7  (Light Blue)
Secondary: #6366f1  (Indigo)
Accent:    #14b8a6  (Teal)
```

---

## Troubleshooting

### Logo Not Showing

**Problem**: Logo URL entered but not displaying

**Solutions**:
1. Verify URL is direct image link (ends with .png, .jpg, .svg)
2. Check URL is accessible (open in browser)
3. Ensure hosting service allows hotlinking
4. Try uploading to different hosting service (Imgur is reliable)

### Colors Not Applying

**Problem**: Saved colors but not seeing changes

**Solutions**:
1. **Refresh the page** after saving
2. Clear browser cache (Ctrl+Shift+Delete)
3. Verify hex codes are valid (#XXXXXX format)
4. Try logging out and back in

### Permission Denied

**Problem**: Can't access Settings page

**Solution**:
- Only **Admin** users can access Settings
- Login with admin account:
  - Email: `admin@hospital.com`
  - Password: `Admin@123`

### Branding Resets

**Problem**: Branding changes don't persist

**Solutions**:
1. Verify you clicked "Save Changes"
2. Check browser console for errors (F12)
3. Ensure backend server is running
4. Check database connection

---

## Best Practices

### Logo Guidelines

✅ **DO**:
- Use PNG with transparent background
- Recommended size: 200x60px to 400x120px
- Keep file size under 200KB
- Use SVG for scalability (best)

❌ **DON'T**:
- Use very large images (>1MB)
- Use images with text smaller than readable
- Use logos with poor contrast

### Color Selection

✅ **DO**:
- Choose colors from your existing branding
- Test contrast for readability
- Keep primary color as your main brand color
- Use color presets as starting points

❌ **DON'T**:
- Use colors that are too similar
- Choose very bright/neon colors (hard to read)
- Use more than 3-4 brand colors total

### Font Selection

✅ **DO**:
- Choose readable, professional fonts
- Use Inter or System UI for best compatibility
- Match your website/marketing materials

❌ **DON'T**:
- Use decorative/script fonts (hard to read)
- Change fonts frequently
- Use different fonts for different pages

---

## Security Notes

### Access Control
- Only **Admin** role can modify branding
- All other roles can view but not edit
- Branding changes are tenant-isolated

### Data Validation
- Logo URLs are validated (basic URL format)
- Color codes must be valid hex format (#XXXXXX)
- Malicious URLs blocked by browser CORS policies

### Storage
- Branding data stored in PostgreSQL (secure)
- No file uploads to server (URLs only)
- Changes audited in database

---

## Future Enhancements (Roadmap)

### Planned Features:
- [ ] File upload for logos (Supabase Storage)
- [ ] Favicon customization
- [ ] Login page branding
- [ ] Email template branding
- [ ] Invoice/receipt branding
- [ ] Dark mode support
- [ ] Custom CSS injection (advanced)

---

## Support

### Need Help?

1. **Check this guide** for common issues
2. **Database health**: Run `node verify-database-health.js`
3. **Backend logs**: Check `b5a406c.output` file
4. **Frontend errors**: Open browser console (F12)

### Contact

For bugs or feature requests, create an issue in the project repository.

---

## Quick Reference

| Action | Admin Only | URL |
|--------|------------|-----|
| View Settings | ✅ | http://localhost:5173/settings |
| Get Branding | ❌ | GET /api/branding |
| Update Branding | ✅ | PUT /api/branding |
| Upload Logo | ✅ | POST /api/branding/upload-logo |

### Default Branding Values

```
Primary Color:   #3b82f6 (Blue)
Secondary Color: #10b981 (Green)
Accent Color:    #f59e0b (Amber)
Font Family:     Inter
Logo:            None (shows clinic name)
```

---

**Last Updated**: January 22, 2026
**Version**: 1.0.0
**Feature Status**: ✅ Production Ready
