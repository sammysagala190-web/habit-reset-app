# Home Workout Coach

A simple Expo React Native app for tracking bodyweight workouts at home.

## Current features

- monthly calendar view showing completed workout days
- adjustable difficulty: Beginner, Intermediate, Advanced
- workout focus areas: Full Body, Abs, Chest, Legs, Arms, Butt
- daily adaptive workout plan
- post workout feedback: Too Easy, Just Right, Too Hard
- automatic local saving with AsyncStorage
- notes section for session reflections
- optional internet powered suggestion endpoint with offline fallback

## How the smart suggestion works

Right now the app works immediately with a built in adaptive engine.

If you want internet based suggestions, open `App.tsx` and set `ONLINE_SUGGESTION_URL` to your API endpoint.

Expected JSON request body:

```json
{
  "difficulty": "Beginner",
  "focus": "Abs",
  "previousFeedback": "Just Right"
}
```

Expected JSON response body:

```json
{
  "title": "Beginner Abs Session",
  "durationMin": 18,
  "intensity": "Low to moderate",
  "restSeconds": 35,
  "exercises": ["Dead Bug", "Plank", "Heel Taps"]
}
```

## Run locally

1. Install Node.js LTS
2. Clone the repo
3. Run:

```bash
npm install
npx expo start
```

4. Open on your iPhone using Expo Go, or run the iOS simulator on a Mac

## Important note for iPhone

To test on a real iPhone without Xcode, install **Expo Go** from the App Store and scan the QR code from `npx expo start`.

## Next upgrades to build

- history page with all sessions
- reminder notifications
- calorie estimate and trend charts
- user profile and goal settings
- backend AI suggestion service
- cloud sync and sign in
