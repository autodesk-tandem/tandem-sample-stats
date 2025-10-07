# Troubleshooting Guide

## OAuth Authorization Issues

If you're having trouble with authentication, follow these steps:

### Step 1: Check Browser Console

Open your browser's Developer Tools (F12 or Cmd+Option+I on Mac) and look at the Console tab. The app now logs detailed OAuth information:

- 🔐 Initiating OAuth login...
- ✅ OAuth callback received
- 🔄 Exchanging authorization code for token...
- ✅ Token received successfully

Or errors like:
- ❌ Token exchange failed
- ❌ Authentication error

### Step 2: Verify Forge App Configuration

1. **Go to your Forge app**: https://aps.autodesk.com/myapps
2. **Check the Callback URL** must be EXACTLY:
   ```
   http://localhost:8000
   ```
   - No trailing slash
   - Must be lowercase
   - Must match the port you're using

3. **Check API Access** - Your app needs these APIs enabled:
   - ✅ APS Data Management API
   - ✅ Tandem API

4. **Check Client ID** - Copy it from your Forge app and ensure it matches what's in `js/config.js`

### Step 3: Verify Your Local Server

1. **Check the port**: Make sure your server is running on port 8000
   ```bash
   # Check if something is listening on port 8000
   lsof -i :8000
   # or
   netstat -an | grep 8000
   ```

2. **Access exactly as**: `http://localhost:8000` (not 127.0.0.1, not with https)

### Step 4: Check for Common Issues

#### Issue: "Invalid redirect_uri"
**Solution**: The redirect URI in your Forge app settings must exactly match `http://localhost:8000`

#### Issue: "Invalid client"
**Solution**: 
- Double-check your Client ID in `js/config.js`
- Make sure there are no extra spaces or quotes
- Verify you're using the correct environment (prod vs staging)

#### Issue: "Invalid scope"
**Solution**: Make sure your Forge app has Tandem API access enabled

#### Issue: Page redirects to Autodesk login but doesn't come back
**Solution**: 
- Check that you're running on exactly `http://localhost:8000`
- Verify the callback URL in your Forge app
- Check browser console for errors

#### Issue: Token exchange fails with 400 Bad Request
**Solution**: This usually means:
- Client ID doesn't match
- Redirect URI doesn't match
- Code verifier/challenge mismatch (try clearing browser cache/localStorage)

### Step 5: Clear Browser Data

Sometimes old data can cause issues:

1. Open DevTools Console
2. Run these commands:
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload()
   ```

### Step 6: Test with Different Browser

Try a different browser or incognito/private window to rule out extension or cache issues.

### Step 7: Verify Network Requests

In DevTools Network tab, look for:
1. Request to `developer.api.autodesk.com/authentication/v2/authorize` (should succeed)
2. After redirect, request to `developer.api.autodesk.com/authentication/v2/token` (check response)

If the token request fails, look at the response body for error details.

## Common Error Messages

### "No accounts or facilities found"
**Cause**: Authentication succeeded but no Tandem facilities are accessible

**Solution**:
- Verify you have access to at least one Tandem facility
- Check that your Tandem license is active
- Try accessing https://tandem.autodesk.com directly to verify access

### "Failed to fetch groups"
**Cause**: API request failed after authentication

**Solution**:
- Check your internet connection
- Verify Tandem API is accessible
- Check browser console for CORS errors
- Ensure your token hasn't expired (try logout/login)

### CORS Errors
**Cause**: Not using a proper web server or wrong URL

**Solution**:
- Don't open index.html directly (no `file://` URLs)
- Use a proper web server (Python http.server, http-server, Live Server)
- Access via `http://localhost:8000`

## Debug Mode

To see even more debug information:

1. Open `js/config.js`
2. Add this at the top:
   ```javascript
   window.DEBUG = true;
   ```

3. Check console for additional logging

## Still Having Issues?

1. **Document what you see**:
   - Exact error messages from console
   - Network tab showing failed requests
   - Screenshots if helpful

2. **Verify these are correct**:
   - Client ID: `GiedMKsyhXTTG34RZR9KSEGbAgjxSIJm45sJASP9EjOQSAX8`
   - Redirect URI in Forge app: `http://localhost:8000`
   - Server URL you're accessing: `http://localhost:8000`
   - APIs enabled: Data Management API + Tandem API

3. **Check Forge App Status**:
   - Is it active?
   - Is it in production (not just staging)?
   - Do you have Tandem API access enabled?

4. **Try the working sample**:
   - Test with the original `tandem-sample-rest-testbed` to verify your credentials work
   - If that works but this doesn't, compare the configurations

## Quick Diagnostic

Run this in the browser console when on the app page:

```javascript
console.log('Config Check:');
console.log('- Client ID:', window.location.origin);
console.log('- Current URL:', window.location.href);
console.log('- Has code verifier:', !!localStorage.getItem('codeVerifier'));
console.log('- Has token:', !!sessionStorage.getItem('token'));
```

This will show your current configuration and state.
