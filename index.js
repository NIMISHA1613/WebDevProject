// Author: Nimisha Gosain

const express = require("express");
const path = require("path");

// import express-fileupload that was installed so need to acquire it to make req.files available, as it is a middleware
const fileUpload = require("express-fileupload");

const fs = require("fs");

const { check, validationResult, oneOf } = require("express-validator");
const {
  saveRequestForm,
  authenticate,
  getDashboard,
  getDeliveryRequestById,
  updateRequestForm,
  deleteRequestForm,
} = require("./dal/mongoClient");
const session = require("express-session");

var app = express();
app.use(express.urlencoded({ extended: false }));

app.use(fileUpload()); // setup the express file upload middleware to be used with Express
// set path to public folders and view folders

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "/web_content/views"));
app.use(express.static(__dirname + "/web_content/public"));

// setting up the middleware for session
app.use(
  session({
    secret: "secrettokencreated",
    resave: false,
    saveUninitialized: true,
  })
);

app.get("/", function (req, res) {
  //if logged in user then redirect to admin home
  if (req.session.loggedIn) {
    res.redirect("/dashboard");
    return;
  }

  res.redirect("/request_form");
});

app.get("/request_form", function (req, res) {
  res.render("requestForm", { errors: [], session: req.session, mode: "new" });
});

app.get("/login", function (req, res) {
  //if user already logged in redirect to home for admin
  if (req.session.loggedIn) {
    res.redirect("/dashboard");
    return;
  }
  // render login page
  let errors = req.query.errors;
  res.render("login", { errors, session: req.session });
});

app.post(
  "/authenticate",
  [
    check("username", "Username cannot be empty").notEmpty(),
    check("password", "Password is not valid").notEmpty().isStrongPassword(),
  ],
  async function (req, res) {
    let { username, password } = req.body;

    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.redirect("/login?errors=true");
      return;
    }

    //if successfully authenticated
    let result = await authenticate(username, password);

    if (result) {
      req.session.uAdminName = username;
      req.session.loggedIn = true;
      res.redirect("/dashboard");
      return;
    } else {
      res.redirect("/login?errors=true");
    }
  }
);

app.get("/logout", function (req, res) {
  // render logout page and log out user
  if (req.session.loggedIn) {
    req.session.loggedIn = false;
    req.session.uAdminName = "";
  }

  res.redirect("/login");
});

app.get("/dashboard", async function (req, res) {
  //if user not logged in then redirect to login page that can be checked using session token
  if (!req.session.loggedIn) {
    res.redirect("/login");
    return;
  }
  //else show admin the admin home page
  let deliveryRequests = await getDashboard();

  res.render("admin_views/dashboard", {
    session: req.session,
    deliveryRequests: deliveryRequests,
  });
});

// admin deleting the reqeust from the dashboard table
app.get("/delete/:deliveryRequestId", async function (req, res) {
  if (!req.session.loggedIn) {
    res.redirect("/login");
    return;
  }
  let deliveryRequestID = req.params.deliveryRequestId;

  let deliveryRequest = await getDeliveryRequestById(deliveryRequestID);

  if (deliveryRequest != undefined) {
    let predir = "web_content/public";
    photoPath = predir + deliveryRequest.photoPath;

    if (fs.existsSync(photoPath.replace("/" + deliveryRequest.photoName, ""))) {
      fs.rmdirSync(photoPath.replace("/" + deliveryRequest.photoName, ""), {
        recursive: true,
      });
    }
  }

  let deleteResult = await deleteRequestForm(deliveryRequestID);

  res.render("successPage", { session: req.session });
});

app.get("/view/:deliveryRequestId", async function (req, res) {
  if (!req.session.loggedIn) {
    res.redirect("/login");
    return;
  }
  let deliveryRequestID = req.params.deliveryRequestId;

  let deliveryRequest = await getDeliveryRequestById(deliveryRequestID);

  res.render("admin_views/view_ticket", {
    deliveryRequestID,
    session: req.session,
    mode: "view",
    customerName: deliveryRequest.customerName,
    email: deliveryRequest.email,
    phone: deliveryRequest.phone,
    photoName: deliveryRequest.photoName,
    photoPath: deliveryRequest.photoPath,
    description: deliveryRequest.description,
  });
});

app.get("/edit/:deliveryRequestId", async function (req, res) {
  if (!req.session.loggedIn) {
    res.redirect("/login");
    return;
  }
  let deliveryRequestID = req.params.deliveryRequestId;
  let deliveryRequest = await getDeliveryRequestById(deliveryRequestID);

  res.render("admin_views/view_ticket", {
    deliveryRequestID,
    session: req.session,
    mode: "edit",
    customerName: deliveryRequest.customerName,
    email: deliveryRequest.email,
    phone: deliveryRequest.phone,
    photoName: deliveryRequest.photoName,
    photoPath: deliveryRequest.photoPath,
    description: deliveryRequest.description,
  });
});

// function created for making the image upload mandatory
function customImageChecker(value, { req }) {
  if (req.files == null || req.files.photo == null) {
    throw new Error("Upload an image please");
  }

  let photoName = req.files.photo.name;
  let extension = path.extname(photoName).toLowerCase();

  // created a new function to do extra validation that cannot be performed by the check operator individually
  if ([".jpg", ".jpeg", ".png"].includes(extension)) {
    return true;
  }

  throw new Error("Upload a file of correct format");
}

// function created for making the image upload optional in the website
function customImageCheckerOptionalImg(value, { req }) {
  if (req.files == null || req.files.photo == null) {
    return true;
  }

  let photoName = req.files.photo.name;
  let extension = path.extname(photoName).toLowerCase();

  // created a new function to do extra validation that cannot be performed by the check operator individually
  if ([".jpg", ".jpeg", ".png"].includes(extension)) {
    return true;
  }

  throw new Error("Upload a file of correct format");
}

app.post(
  "/request_form/submit",
  [
    check("customerName", "Name is required").notEmpty().bail().isAlpha(),
    oneOf(
      [
        check("email", "Email is required").isEmpty(),
        check("email", "Email is required").isEmail(),
      ],
      "Email not valid"
    ),
    oneOf(
      [check("phone").isEmpty(), check("phone").notEmpty().isMobilePhone()],
      "Phone number not valid"
    ),
    oneOf(
      [
        check("email", "Email is required").notEmpty(),
        check("phone", "Phone Number is required").notEmpty(),
      ],
      "Please add email or phone number"
    ),
    check("photo").custom(customImageChecker),
    check("description", "Please add something in description")
      .notEmpty()
      .bail()
      .isString(),
  ],
  function (req, res) {
    let { customerName, email, phone, description } = req.body;

    //validate
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render("requestForm", {
        errors: errors.array(),
        session: req.session,
        mode: "new",
      });
      return;
    }

    let photoPath = null;
    let photoName = null;
    if (req.files != undefined && req.files.photo != undefined) {
      photoName = req.files.photo.name;
      // get the actual file
      let photoFile = req.files.photo;
      // check if the file already exists or employ some logic that each filename is unique
      let predir = "web_content/public/";
      let dir = "/uploads/" + Date.now();
      photoPath = dir + "/" + photoName;

      if (!fs.existsSync(predir + dir)) {
        fs.mkdirSync(predir + dir);
      }

      //@TOFIX:
      photoFile.mv(predir + photoPath, function (err) {});
    }

    //save to database by calling the function and displaying successpage
    saveRequestForm(
      customerName,
      email,
      phone,
      photoName,
      photoPath,
      description
    );

    res.render("successPage", { session: req.session });
  }
);

app.post(
  // validation checks are performed below
  "/request_form/update",
  [
    check("customerName", "Name is required").notEmpty().bail().isAlpha(),
    oneOf(
      [
        check("email", "Email is required").isEmpty(),
        check("email", "Email is required").isEmail(),
      ],
      "Email not valid"
    ),
    oneOf(
      [check("phone").isEmpty(), check("phone").notEmpty().isMobilePhone()],
      "Phone number not valid"
    ),
    oneOf(
      [
        check("email", "Email is required").notEmpty(),
        check("phone", "Phone Number is required").notEmpty(),
      ],
      "Please add email or phone number"
    ),
    check("photo").custom(customImageCheckerOptionalImg),
    check("description", "Please add something in description")
      .notEmpty()
      .bail()
      .isString(),
  ],
  async function (req, res) {
    if (!req.session.loggedIn) {
      res.redirect("/login");
      return;
    }

    let {
      deliveryRequestID,
      customerName,
      email,
      phone,
      description,
      photoName,
      photoPath,
    } = req.body;

    //validate
    let errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.render("admin_views/view_ticket", {
        errors: errors.array(),
        session: req.session,
        mode: "edit",
        deliveryRequestID,
        customerName,
        email,
        phone,
        photoName,
        photoPath,
        description,
      });
      return;
    }

    let photoPathNew = null;
    let photoNameNew = null;
    if (req.files != undefined && req.files.photo != undefined) {
      photoNameNew = req.files.photo.name;
      // get the actual file
      let photoFile = req.files.photo;
      // check if the file already exists or employ some logic that each filename is unique
      let predir = "web_content/public/";
      let dir = "/uploads/" + Date.now();
      photoPathNew = dir + "/" + photoNameNew;

      // the new file is uploaded in the path below
      if (!fs.existsSync(predir + dir)) {
        fs.mkdirSync(predir + dir);
      }

      // path defined to be used for removing the file, when delete command is given
      photoPathToRemove = predir + photoPath;

      if (fs.existsSync(photoPathToRemove.replace("/" + photoName, ""))) {
        fs.rmdirSync(photoPathToRemove.replace("/" + photoName, ""), {
          recursive: true,
        });
      }

      photoFile.mv(predir + photoPathNew, function (err) {});
    }

    //add to database
    // calling the asynchronous function from mongoclient.js page
    let result = await updateRequestForm(
      deliveryRequestID,
      customerName,
      email,
      phone,
      photoNameNew,
      photoPathNew,
      description
    );

    res.render("successPage", { session: req.session });
  }
);
// for wrongly written urls it will by default redirect the user to the home page of the website
app.all("*", function (req, res) {
  res.redirect("/");
});

app.listen(8000);
console.log("Check the website here, http://localhost:8000/ ");
