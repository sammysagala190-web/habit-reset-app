# Home Workout Coach V2

This is the upgraded version of the app inside the `v2` folder.

## Added in V2

- tabbed layout: Home, Calendar, History, Settings
- weekly goal tracking
- workout history page
- profile and settings page
- toggle for online workout suggestions
- sample backend server for internet powered workout plans

## Run V2

Open the `v2` folder in your terminal and run:

```bash
npm install
npx expo start
```

## Backend example

The folder `backend-example` contains a small Node.js server.

Run it with:

```bash
node server.js
```

By default it serves:

```text
POST /workout
```

If you host that server somewhere, paste its URL into the Settings tab in the app and turn on **Online suggestions**.

Example full URL:

```text
https://your-domain.com/workout
```

## Good next steps

- add push notifications for reminders
- add charts for weekly and monthly consistency
- add login and cloud sync
- connect to a real LLM or fitness recommendation backend
