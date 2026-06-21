# Branding Debug Guide

## API Status: ✅ WORKING
The backend API is functioning correctly:
- GET /api/branding - Returns current branding
- PUT /api/branding - Updates branding successfully
- Database is saving purple theme colors

## Current Database Values
```
Primary Color: #8b5cf6 (Purple)
Secondary Color: #ec4899 (Pink)
Accent Color: #f43f5e (Rose)
Font: Georgia
```

## Frontend Application Issue

The colors are saved but not visually applied. Let's debug:

### Step 1: Open Browser Console (F12)
1. Navigate to http://localhost:5173/dashboard
2. Open DevTools (F12) → Console tab
3. Look for any errors related to theme or branding

### Step 2: Check CSS Variables
In the Console tab, run this command:
```javascript
// Check if CSS variables are set
const styles = getComputedStyle(document.documentElement);
console.log('Primary 500:', styles.getPropertyValue('--color-primary-500'));
console.log('Primary 600:', styles.getPropertyValue('--color-primary-600'));
console.log('Secondary 500:', styles.getPropertyValue('--color-secondary-500'));
console.log('Accent 500:', styles.getPropertyValue('--color-accent-500'));
```

Expected output should be RGB values like:
```
Primary 500: 139 92 246
Primary 600: 111 74 197
```

If you see empty values, the theme is not being applied.

### Step 3: Check if Theme is Loading
In Console, run:
```javascript
// Check if loadAndApplyBranding is being called
localStorage.getItem('token'); // Should show your JWT token
```

### Step 4: Manual Theme Application Test
Try applying the theme manually in Console:
```javascript
// Test theme application
const testTheme = {
  primaryColor: '#8b5cf6',
  secondaryColor: '#ec4899',
  accentColor: '#f43f5e'
};

// Convert hex to RGB manually
document.documentElement.style.setProperty('--color-primary-500', '139 92 246');
document.documentElement.style.setProperty('--color-primary-600', '111 74 197');
```

If this works and you see color changes, then the issue is with the automatic theme loading.

### Step 5: Check Network Tab
1. Open DevTools → Network tab
2. Refresh page
3. Look for request to `/api/branding`
4. Check:
   - Is the request being made?
   - What's the response?
   - Is there a 200 status code?

### Step 6: Force Theme Reload
In Console, manually trigger theme loading:
```javascript
const token = localStorage.getItem('token');
fetch('http://localhost:3000/api/branding', {
  headers: { 'Authorization': `Bearer ${token}` }
})
.then(r => r.json())
.then(data => {
  console.log('Branding data:', data);
  // The theme should auto-apply here
});
```

## Common Issues

### Issue 1: CSS Variables Not Set
**Symptom**: getComputedStyle shows empty values
**Solution**: Theme utility not being called

### Issue 2: CSS Variables Set But Colors Not Showing
**Symptom**: Variables are set but UI still shows default blue
**Solution**: Tailwind not reading CSS variables correctly

### Issue 3: Theme Loads on Refresh Only
**Symptom**: Colors show after page refresh but not immediately
**Solution**: Need to apply theme in SettingsPage after save

## Next Steps

Based on what you find in the console, we can:
1. Fix the theme loading in MainLayout
2. Ensure CSS variables are being set correctly
3. Verify Tailwind is reading the CSS variables
4. Add better error handling and logging

## Quick Test Commands

Copy and paste these in browser console to test:

```javascript
// 1. Check if variables exist
console.log('=== CSS Variables Check ===');
const root = document.documentElement;
console.log('Primary 50:', getComputedStyle(root).getPropertyValue('--color-primary-50'));
console.log('Primary 500:', getComputedStyle(root).getPropertyValue('--color-primary-500'));
console.log('Primary 900:', getComputedStyle(root).getPropertyValue('--color-primary-900'));

// 2. Manually set purple theme
console.log('\n=== Setting Purple Theme Manually ===');
document.documentElement.style.setProperty('--color-primary-50', '236 233 250');
document.documentElement.style.setProperty('--color-primary-100', '223 215 247');
document.documentElement.style.setProperty('--color-primary-200', '196 181 241');
document.documentElement.style.setProperty('--color-primary-300', '155 135 233');
document.documentElement.style.setProperty('--color-primary-400', '121 92 226');
document.documentElement.style.setProperty('--color-primary-500', '139 92 246');
document.documentElement.style.setProperty('--color-primary-600', '111 74 197');
document.documentElement.style.setProperty('--color-primary-700', '90 60 160');
document.documentElement.style.setProperty('--color-primary-800', '70 46 123');
document.documentElement.style.setProperty('--color-primary-900', '49 32 86');
console.log('Purple theme applied! Check if colors changed.');

// 3. Check what Tailwind is using
console.log('\n=== Tailwind Color Check ===');
const primaryButton = document.querySelector('.bg-primary-600');
if (primaryButton) {
  console.log('Found element with bg-primary-600');
  console.log('Computed background:', getComputedStyle(primaryButton).backgroundColor);
} else {
  console.log('No element with bg-primary-600 found on this page');
}
```
