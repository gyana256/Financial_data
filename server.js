const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const distPath = path.join(__dirname, 'fina', 'supabase-ui', 'dist');

// Serve static files
app.use(express.static(distPath));

// Always serve index.html for SPA routes (use middleware to avoid route parsing issues)
app.use((req, res, next) => {
  if (req.method !== 'GET') return next();
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) next(err);
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}. Serving ${distPath}`);
});
