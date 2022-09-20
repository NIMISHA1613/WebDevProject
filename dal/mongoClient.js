// Author: Nimisha Gosain

const mongoose = require("mongoose");
const session = require("express-session");

// connect to DB
mongoose.connect("mongodb://localhost:27017/DeliveryRequests", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// create model for deliveryrequests data saved in the db
const DeliveryRequests = mongoose.model("DeliveryRequests", {
  customerName: String,
  email: String,
  phone: String,
  photoName: String,
  photoPath: String,
  description: String,
});

// define model for admin users
const AdminUser = mongoose.model("AdminUser", {
  uAdminName: String,
  uAdminPassword: String,
});

async function getDashboard() {
  return await DeliveryRequests.find({});
}

// fetch unique id for each delivery request
async function getDeliveryRequestById(deliveryRequestId) {
  return await DeliveryRequests.findOne({
    _id: deliveryRequestId,
  });
}

async function authenticate(uname, upassword) {
  // find its instance in the database
  let user = await AdminUser.findOne({
    uAdminName: uname,
    uAdminPassword: upassword,
  });

  if (user) {
    return true;
  } else {
    return false;
  }
}

// function created to delete request form based on id
async function deleteRequestForm(deliveryRequestID) {
  return await DeliveryRequests.deleteOne({ _id: deliveryRequestID });
}

async function updateRequestForm(
  deliveryRequestID,
  customerName,
  email,
  phone,
  photoName,
  photoPath,
  description
) {
  let data = {
    customerName,
    email,
    phone,
    description,
  };

  if (photoName != undefined && photoPath != undefined) {
    data.photoName = photoName;
    data.photoPath = photoPath;
  }

  return await DeliveryRequests.updateOne({ _id: deliveryRequestID }, data);
}
// save data of request form
function saveRequestForm(
  customerName,
  email,
  phone,
  photoName,
  photoPath,
  description
) {
  // create an object from the model to save to DB
  var deliveryRequests = new DeliveryRequests({
    customerName,
    email,
    phone,
    photoName,
    photoPath,
    description,
  });

  // save it to DB
  deliveryRequests.save();
}

// exporting the functions so that they could be called and used in index.js
module.exports = {
  saveRequestForm,
  authenticate,
  getDashboard,
  getDeliveryRequestById,
  updateRequestForm,
  deleteRequestForm,
};
