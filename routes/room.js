const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const isAuthenticated = require("../middleware/isAuthenticated");

const User = require("../models/User");
const Room = require("../models/Room");

router.post("/room/publish", isAuthenticated, async (req, res) => {
  console.log("Félicitation tu es authentifié(e)");
  try {
    const { title, description, price, location } = req.fields;

    let newLocation = location;

    if (typeof location === "string") {
      newLocation = JSON.parse(req.fields.location);
    }

    if (title && description && price && newLocation) {
      const locationArray = [newLocation.lat, newLocation.lng];

      const newRoom = new Room({
        title: title,
        description: description,
        price: price,
        location: locationArray,
        user: req.user._id,
      });

      await newRoom.save();

      const user = await User.findById(req.user._id);

      let tab = user.rooms;

      tab.push(newRoom._id);

      await User.findByIdAndUpdate(req.user._id, {
        rooms: tab,
      });

      res.status(200).json(newRoom);
    } else {
      res.status(400).json({ message: "Missing parameter(s)" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/rooms", async (req, res) => {
  try {
    const filters = {};

    if (req.query.title) {
      filters.title = new RegExp(req.query.title, "i");
    }

    if (req.query.priceMin && !req.query.priceMax) {
      filters.price = {
        $gte: Number(req.query.priceMin),
      };
    }
    if (req.query.priceMax && !req.query.priceMin) {
      filters.price = {
        $lte: Number(req.query.priceMax),
      };
    }

    if (req.query.priceMax && req.query.priceMin) {
      filters.price = {
        $gte: Number(req.query.priceMin),
        $lte: Number(req.query.priceMax),
      };
    }

    const sort = {};

    if (req.query.sort) {
      if (req.query.sort === "price-asc") {
        sort.price = "asc";
      }
      if (req.query.sort === "price-desc") {
        sort.price = "desc";
      }
    }

    const limit = Number(req.query.limit) || 3;
    const page = Number(req.query.page);
    let hiddenOffers;
    if (page === 1 || !page) {
      hiddenOffers = 0;
    } else if (page > 1) {
      hiddenOffers = (page - 1) * limit;
    }

    const rooms = await Room.find(filters, { description: false })
      .sort(sort)
      .limit(limit)
      .skip(hiddenOffers)
      .populate({
        path: "user",
        select: "account",
      });
    res.status(200).json(rooms);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/rooms/:id", async (req, res) => {
  try {
    if (req.params.id) {
      const room = await Room.findById(req.params.id).populate({
        path: "user",
        select: "account",
      });
      if (room) {
        res.status(200).json(room);
      } else {
        res.status(400).json({ message: "Room not found" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/room/update/:id", isAuthenticated, async (req, res) => {
  const { title, price, description, location } = req.fields;
  try {
    if (req.params.id) {
      const roomToModify = await Room.findById(req.params.id);

      if (roomToModify) {
        const userId = req.user._id;
        const roomUserId = roomToModify.user._id;

        if (String(userId) === String(roomUserId)) {
          if (title || price || description || location) {
            if (title) {
              roomToModify.title = title;
            }
            if (price) {
              roomToModify.price = price;
            }
            if (description) {
              roomToModify.description = description;
            }
            if (location) {
              let newLocation = location;
              // pour des requetes postman avec form data
              if (typeof location === "string") {
                newLocation = JSON.parse(req.fields.location);
              }
              const locationArray = [newLocation.lat, newLocation.lng];

              roomToModify.location = locationArray;
            }

            await roomToModify.save();

            res.status(200).json(roomToModify);
          } else {
            res.status(401).json({ message: "Missing parameter(s)" });
          }
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(400).json({ message: "Room not found" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/room/delete/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const roomToDelete = await Room.findById(req.params.id);

      if (roomToDelete) {
        const userId = req.user._id;
        const roomUserId = roomToDelete.user._id;
        if (String(userId) === String(roomUserId)) {
          await Room.findByIdAndDelete(req.params.id);
          res.status(200).json({ message: "Room deleted" });
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(400).json({ message: "Room not found" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// upload une image après l'autre
router.put("/room/upload_picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const room = await Room.findById(req.params.id);
      if (room) {
        const UserId = req.user._id;
        const RoomUserId = room.user._id;
        if (String(UserId) === String(RoomUserId)) {
          let arrayPhotos = room.photos;
          if (arrayPhotos.length < 5) {
            await cloudinary.uploader.upload(
              req.files.picture.path,
              {
                folder: `/airbnb/rooms_photos/${room.user._id}`,
              },

              async (error, result) => {
                const newObj = {
                  url: result.secure_url,
                  picture_id: result.public_id,
                };
                arrayPhotos.push(newObj);
              }
            );
          }

          await Room.findByIdAndUpdate(req.params.id, { photos: arrayPhotos });

          const roomPhotosUpdate = await Room.findById(req.params.id);
          res.status(200).json(roomPhotosUpdate);
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(400).json({ message: "Room doesn't exist" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

//Uploade plusieurs images
/*router.put("/room/upload_picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const room = await Room.findById(req.params.id);
      if (room) {
        const UserId = req.user._id;
        const RoomUserId = room.user._id;
        if (String(UserId) === String(RoomUserId)) {
          let arrayPhotos = room.photos;
          const fileKeys = Object.keys(req.files); //["picture1","picture2"]
          for (let i = 0; i < fileKeys.length; i++) {
            await cloudinary.uploader.upload(
              req.files[fileKeys[i]].path,
              {
                folder: `/airbnb/rooms_photos/${room.user._id}`,
              },

              async (error, result) => {
                const newObj = {
                  url: result.secure_url,
                  picture_id: result.public_id,
                };
                arrayPhotos.push(newObj);
              }
            );
          }

          await Room.findByIdAndUpdate(req.params.id, { photos: arrayPhotos });

          const roomPhotosUpdate = await Room.findById(req.params.id);
          res.status(200).json(roomPhotosUpdate);
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(400).json({ message: "Room doesn't exist" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});*/

router.delete("/room/delete_picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const room = await Room.findById(req.params.id);

      if (room) {
        const UserId = req.user._id;
        const RoomUserId = room.user._id;

        if (String(UserId) === String(RoomUserId)) {
          let picture_id = req.fields.picture_id;

          let array = room.photos;

          let isPhoto = false;
          for (let i = 0; i < array.length; i++) {
            if (array[i].picture_id === picture_id) {
              isPhoto = true;
            }
          }

          if (isPhoto === false) {
            res.status(400).json({ error: "Picture not found" });
          } else {
            for (let j = 0; j < array.length; j++) {
              if (array[j].picture_id === picture_id) {
                let index = array.indexOf(array[j]);

                array.splice(index, 1);

                await cloudinary.uploader.destroy(picture_id);

                await Room.findByIdAndUpdate(req.params.id, {
                  photos: array,
                });
              }
            }
            res.status(200).json({ message: "Picture delete" });
          }
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(400).json({ message: "Room not found" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
