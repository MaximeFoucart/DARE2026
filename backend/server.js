const express = require("express");
const path = require("path");

const port = 3000;
const build_dir = path.join(__dirname, "../frontend/build");

const app = express();

//serve static files from the React app
app.use(express.static(build_dir));

//serve the index.html file for any unknown routes, found on internet
app.use((req, res) => res.sendFile(path.join(build_dir, "index.html")));

//start the server
app.listen(port, () => {
  console.log(`Server started on http://localhost:${port}`);
});