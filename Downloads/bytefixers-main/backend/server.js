// const app = require("./app");
// const connectDB = require("./config/db");

// if (process.env.NODE_ENV !== "test") {
//   connectDB();
//   app.listen(process.env.PORT, () => {
//     console.log(`Server is running on port ${process.env.PORT}`);
//   });
// }
const app = require("./app");
const { connectDB } = require("./config/db");

const PORT = process.env.PORT || 5000;

if (process.env.NODE_ENV !== "test") {
  connectDB(); // connectDB is async, you can await it or handle promise here
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

