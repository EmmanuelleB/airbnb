const express = require("express");
const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const mailgun = require("mailgun-js");

const User = require("../models/User");
const Room = require("../models/Room");
const isAuthenticated = require("../middleware/isAuthenticated");

//mailgun
const DOMAIN = process.env.MAILGUN_DOMAIN;
const mg = mailgun({ apiKey: process.env.MAILGUN_API_KEY, domain: DOMAIN });

router.post("/user/sign_up", async (req, res) => {
  try {
    const { email, password, username, name, description } = req.fields;

    const userMail = await User.findOne({ email: email });
    const userUsername = await User.findOne({ "account.username": username });

    if (userMail || userUsername) {
      res.status(400).json({ message: "Email or username is already used" });
    } else {
      if (password && email && username && name && description) {
        const salt = uid2(16);

        const hash = SHA256(salt + password).toString(encBase64);

        const token = uid2(16);

        const newUser = new User({
          email: email,
          account: {
            username: username,
            name: name,
            description: description,
          },
          salt: salt,
          hash: hash,
          token: token,
        });

        await newUser.save();

        res.status(200).json({
          _id: newUser._id,
          token: newUser.token,
          email: newUser.email,
          account: {
            username: newUser.account.username,
            description: newUser.account.description,
            name: newUser.account.name,
          },
        });
      } else {
        res.status(400).json({ message: "Missing parameter(s)" });
      }
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/user/log_in", async (req, res) => {
  try {
    const { email, password } = req.fields;

    const user = await User.findOne({ email: email });

    if (user) {
      if (email && password) {
        const newHash = SHA256(user.salt + password).toString(encBase64);
        if (user.hash === newHash) {
          res.status(200).json({
            _id: user._id,
            token: user.token,
            email: user.email,
            account: {
              username: user.account.username,
              description: user.account.description,
              name: user.account.name,
            },
          });
        } else {
          res.status(400).json({ message: "Password doesn't work" });
        }
      } else {
        res.status(400).json({ message: "Missing parameter(s)" });
      }
    } else {
      res.status(400).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/user/upload-picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const user = await User.findById(req.params.id);
      if (user) {
        if (String(req.user._id) === String(user._id)) {
          if (req.files.picture) {
            if (!user.account.photo) {
              const pictureToUpdate = await cloudinary.uploader.upload(req.files.picture.path, {
                folder: `/airbnb/profile_photo_user/${user._id}`,
                public_id: req.files.picture,
              });

              user.account.photo = pictureToUpdate;

              await user.save();

              res.status(200).json({
                _id: user._id,
                email: user.email,
                rooms: user.rooms,
                account: {
                  username: user.account.username,
                  description: user.account.description,
                  name: user.account.name,
                  photo: {
                    url: user.account.photo.url,
                    picture_id: user.account.photo.asset_id,
                  },
                },
              });
            } else {
              const pictureToModify = await cloudinary.uploader.upload(req.files.picture.path, {
                folder: `/airbnb/profile_photo_user/${user._id}`,
                public_id: req.files.picture,
                overwrite: true,
              });
              user.account.photo = pictureToModify;

              await user.save();

              res.status(200).json({
                _id: user._id,
                email: user.email,
                rooms: user.rooms,
                account: {
                  username: user.account.username,
                  description: user.account.description,
                  name: user.account.name,
                  photo: {
                    url: user.account.photo.url,
                    picture_id: user.account.photo.asset_id,
                  },
                },
              });
            }
          } else {
            res.status(400).json({ message: "Missing photo" });
          }
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/user/delete-picture/:id", isAuthenticated, async (req, res) => {
  try {
    if (req.params.id) {
      const user = await User.findById(req.params.id);

      if (user) {
        if (String(req.user._id) === String(user._id)) {
          await cloudinary.uploader.destroy(`${user.account.photo.public_id}`);

          await cloudinary.api.delete_folder(`/airbnb/profile_photo_user/${user._id}`);

          await User.findByIdAndUpdate(req.params.id, {
            "account.photo": null,
          });

          res.status(200).json({
            _id: user._id,
            email: user.email,
            rooms: user.rooms,
            account: {
              username: user.account.username,
              description: user.account.description,
              name: user.account.name,
            },
          });
        } else {
          res.status(401).json({ message: "Unauthorized" });
        }
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/user/update", isAuthenticated, async (req, res) => {
  const { email, username, name, description } = req.fields;
  try {
    if (email || username || name || description) {
      if (email) {
        const newEmail = await User.findOne({ email: email });
        if (newEmail) {
          res.status(400).json({ message: "this email is already used." });
        }
      }

      if (username) {
        const newUsername = await User.findOne({
          "account.username": username,
        });

        if (newUsername) {
          res.status(400).json({ message: "this username is already used." });
        }
      }

      const userToModify = req.user;

      if (email) {
        userToModify.email = email;
      }
      if (description) {
        userToModify.account.description = description;
      }
      if (username) {
        userToModify.account.username = username;
      }
      if (name) {
        userToModify.account.name = name;
      }

      await userToModify.save();
      res.status(200).json({
        _id: userToModify._id,
        token: userToModify.token,
        email: userToModify.email,
        account: {
          username: userToModify.account.username,
          description: userToModify.account.description,
          name: userToModify.account.name,
        },
        rooms: userToModify.rooms,
      });
    } else {
      res.status(400).json({ message: "Missing parameter(s)" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/user/update_password", isAuthenticated, async (req, res) => {
  const { previousPassword, newPassword } = req.fields;
  try {
    if (previousPassword && newPassword) {
      const user = req.user;

      const hashPreviousPassword = SHA256(user.salt + previousPassword).toString(encBase64);

      //verifier si l'ancien mdp est correct
      if (user.hash === hashPreviousPassword) {
        const hashNewPassword = SHA256(user.salt + newPassword).toString(encBase64);
        // verifier si l'ancien mdp et le nouveau sont différents
        if (hashPreviousPassword !== hashNewPassword) {
          const newSalt = uid2(16);
          const newToken = uid2(16);
          const newHash = SHA256(newSalt + newPassword).toString(encBase64);

          user.salt = newSalt;
          user.hash = newHash;
          user.token = newToken;

          await user.save();

          const data = {
            from: "Mailgun Test MDP Airbnb <postmaster@" + process.env.MAILGUN_DOMAIN + ">",
            to: "emmanuellebaron1@gmail.com",
            subject: "Mot de passe Airbnb",
            text: `Le mot de passe de ${user.account.username} a bien été modifié.`,
          };

          await mg.messages().send(data, function (error, body) {
            if (error) {
              res.status(400).json({ message: "An error occurred" });
            } else {
              res.status(200).json({
                _id: user._id,
                token: user.token,
                email: user.email,
                account: {
                  username: user.account.username,
                  description: user.account.description,
                  name: user.account.name,
                },
                rooms: user.rooms,
              });
            }
          });
        } else {
          res.status(400).json({ message: "Password must be different " });
        }
      } else {
        res.status(400).json({ message: "Password isn't correct " });
      }
    } else {
      res.status(400).json({ message: "Missing parameter(s)" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/user/recover_password/", async (req, res) => {
  try {
    if (req.fields.email) {
      const user = await User.findOne({ email: req.fields.email });

      if (user) {
        //création d'un token spécial pr modifier le mdp
        const update_password_token = uid2(16);
        user.updatePasswordToken = update_password_token;

        //on genere un timing pour modifier le mdp
        const update_password_expireAt = Date.now();
        user.updatePasswordExpireAt = update_password_expireAt;

        await user.save();

        const data = {
          from: "Mailgun Test MDP Airbnb <postmaster@" + process.env.MAILGUN_DOMAIN + ">",
          to: "emmanuellebaron1@gmail.com",
          subject: "Changez votre mot de passe sur Airbnb",
          text: `Veuillez cliquer sur le lien ci-dessous pour créer un nouveau mot de passe : https://airbnb/change_password?token=${update_password_token}. Vous avez 15 mins`,
        };

        await mg.messages().send(data, function (error, body) {
          if (error) {
            res.status(400).json({ message: "An error occurred" });
          } else {
            res.status(200).json({ message: "A link has been sent to the user" });
          }
        });
      } else {
        res.status(400).json({ message: "User not found" });
      }
    } else {
      res.status(400).json({ message: "Missing email" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/user/reset_password/", async (req, res) => {
  const { updatePasswordToken, password } = req.fields;
  try {
    if (updatePasswordToken && password) {
      const user = await User.findOne({ updatePasswordToken: updatePasswordToken });

      if (user) {
        const date = Date.now();

        const difference = date - user.updatePasswordExpireAt;

        let isExpired;
        if (difference < 9000000) {
          isExpired = false;
        } else {
          isExpired = true;
        }

        if (!isExpired) {
          const newSalt = uid2(16);
          const newHash = SHA256(password + user.salt).toString(encBase64);
          const newToken = uid2(16);

          user.salt = newSalt;
          user.hash = newHash;
          user.token = newToken;
          user.updatePasswordToken = null;
          user.updatePasswordExpireAt = null;

          await user.save();

          res.status(200).json({
            _id: user._id,
            token: user.token,
            email: user.email,
          });
        } else {
          res.status(400).json({ message: "Time is expired" });
        }
      } else {
        res.status(400).json({ message: "User not found" });
      }
    } else {
      res.status(400).json({ message: "Missing parameter(s)" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    if (req.params.id) {
      const user = await User.findById(req.params.id);
      if (user) {
        res.status(200).json({
          _id: user._id,
          email: user.email,
          account: user.account,
          rooms: user.rooms,
        });
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/user/rooms/:id", async (req, res) => {
  try {
    if (req.params.id) {
      const user = await User.findById(req.params.id);
      if (user) {
        const rooms = user.rooms;

        if (rooms.length > 0) {
          const newArray = [];

          for (let i = 0; i < rooms.length; i++) {
            const idRoom = rooms[i];
            const room = await Room.findById(idRoom);
            newArray.push(room);
          }
          res.status(200).json(newArray);
        } else {
          res.status(400).json({ message: "This user has not room" });
        }
      } else {
        res.status(401).json({ message: "Unauthorized" });
      }
    } else {
      res.status(400).json({ message: "Missing ID" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/user/delete", isAuthenticated, async (req, res) => {
  const {} = req.fields;
  try {
    const user = req.user;

    if (user) {
      const rooms = await Room.find({ user: user._id });

      for (let i = 0; i < rooms.length; i++) {
        await cloudinary.uploader.destroy(rooms[i].photos);
        // console.log("--1---" + rooms[i].photos);
        // console.log("--1---" + rooms[i].user._id);
        await cloudinary.api.delete_folder(`/airbnb/rooms_photos/${user._id}`);
        // console.log("--2---" + user._id);
        await Room.findByIdAndRemove(rooms[i]._id);
      }

      await User.findByIdAndDelete(user._id);
      res.status(200).json({ message: "User deleted" });
    } else {
      res.status(401).json({ message: "Unauthorized" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;
