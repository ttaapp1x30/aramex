const mongoose = require("mongoose");

// Define Mongoose schema and model for admin users
const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
});
const Admin = mongoose.model("Admin", adminSchema);

module.exports = Admin;
