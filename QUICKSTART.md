# Quick Start Guide

## Step 1: Configure Your Forge Client ID

1. Open `js/config.js`
2. Replace the empty string with your Forge Client ID:

```javascript
forgeKey: "YOUR_CLIENT_ID_HERE",
```

## Step 2: Configure OAuth Redirect

Make sure your Forge application has this redirect URI configured:
- `http://localhost:8000`

## Step 3: Start Local Server

Choose one of these options:

**Option A: Python 3**
```bash
cd tandem-stats
python3 -m http.server 8000
```

**Option B: Node.js**
```bash
cd tandem-stats
npx http-server -p 8000
```

**Option C: VS Code Live Server**
- Install the "Live Server" extension
- Right-click on `index.html` and select "Open with Live Server"
- Note: You may need to configure it to use port 8000

## Step 4: Open the Application

Navigate to: `http://localhost:8000`

## Step 5: Sign In

1. Click the "Sign In" button
2. Log in with your Autodesk credentials
3. Authorize the application

## Step 6: Explore Your Facilities

1. Select an account from the dropdown
2. Select a facility from the facility dropdown
3. View facility information and statistics

## Troubleshooting

### "No accounts or facilities found"
- Make sure you have access to at least one Tandem facility
- Check that your user account has the appropriate permissions

### Authentication fails
- Verify your Forge Client ID is correct
- Ensure the redirect URI is properly configured in your Forge app
- Check browser console for error messages

### CORS errors
- Make sure you're using a proper web server (not file://)
- Verify you're accessing via `http://localhost:8000`

## Next Steps

The application is ready to be extended with additional features:
- Custom statistics and analytics
- Data visualization
- Property management
- Stream monitoring
- And more!

Refer to the [Tandem API Documentation](https://aps.autodesk.com/en/docs/tandem/v1/developers_guide/overview/) for more API capabilities.
