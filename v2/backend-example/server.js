const http = require('http');

function buildWorkout({ difficulty = 'Beginner', focus = 'Full Body', previousFeedback = 'Just Right' }) {
  const base = {
    Beginner: { durationMin: 16, intensity: 'Low to moderate', restSeconds: 40 },
    Intermediate: { durationMin: 24, intensity: 'Moderate', restSeconds: 30 },
    Advanced: { durationMin: 32, intensity: 'Moderate to high', restSeconds: 20 },
  };

  const bank = {
    'Full Body': ['Jumping Jacks', 'Squats', 'Push Ups', 'Mountain Climbers', 'Glute Bridges', 'Plank'],
    Abs: ['Dead Bug', 'Leg Raises', 'Plank', 'Heel Taps', 'Bicycle Crunches'],
    Chest: ['Push Ups', 'Wide Push Ups', 'Incline Push Ups', 'Pike Push Ups'],
    Legs: ['Squats', 'Reverse Lunges', 'Wall Sit', 'Calf Raises'],
    Arms: ['Triceps Dips on Chair', 'Shoulder Taps', 'Plank Up Downs', 'Diamond Push Ups'],
    Butt: ['Glute Bridges', 'Donkey Kicks', 'Fire Hydrants', 'Hip Thrusts'],
  };

  let label = difficulty;
  if (previousFeedback === 'Too Easy' && difficulty === 'Beginner') label = 'Intermediate';
  if (previousFeedback === 'Too Easy' && difficulty === 'Intermediate') label = 'Advanced';
  if (previousFeedback === 'Too Hard' && difficulty === 'Advanced') label = 'Intermediate';
  if (previousFeedback === 'Too Hard' && difficulty === 'Intermediate') label = 'Beginner';

  return {
    title: `${label} ${focus} Session`,
    durationMin: base[label].durationMin,
    intensity: base[label].intensity,
    restSeconds: base[label].restSeconds,
    exercises: bank[focus] || bank['Full Body'],
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/workout') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const payload = JSON.parse(body || '{}');
      const result = buildWorkout(payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
    }
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Workout suggestion server running on port ${port}`);
});
