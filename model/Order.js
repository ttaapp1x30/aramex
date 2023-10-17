const mongoose = require("mongoose");

// Define Mongoose schema and model for admin users
const orderSchema = new mongoose.Schema({
  person_name: String,
  product_name: String,
  track_number: String,
  delivery_address: String,
  phone_number: String,
  amount_held: String,
});
const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
