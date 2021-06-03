const mongoose = require("mongoose");

const Room = mongoose.model("Room", {
  title: { required: true, type: String },
  description: { required: true, type: String },
  price: { required: true, type: Number },
  location: [Number],
  photos: [Object],
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

module.exports = Room;
