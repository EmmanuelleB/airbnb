const express = require("express");
const formidable = require("express-formidable");
const mongoose = require("mongoose");
const cloudinary = require("cloudinary").v2;
const mailgun = require("mailgun-js");
require("dotenv").config();

const app = express();
app.use(formidable());

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const userRoutes = require("./routes/user");
app.use(userRoutes);
const roomRoutes = require("./routes/room");
app.use(roomRoutes);

app.get("/", (req, res) => {
  try {
    res.status(200).json({ message: "route ok!" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

app.all("*", (req, res) => {
  res.status(404).json({ message: "Page not found" });
});

app.listen(process.env.PORT, () => {
  console.log(`Server started on ${process.env.PORT}`);
});
