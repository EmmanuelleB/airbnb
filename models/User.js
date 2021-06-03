const mongoose = require("mongoose");

const User = mongoose.model("User", {
  email: { unique: true, required: true, type: String },
  token: String,
  hash: String,
  salt: String,
  account: {
    username: { required: true, type: String },
    name: { required: true, type: String },
    description: { required: true, type: String },
    photo: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  rooms: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
  ],
});

module.exports = User;
