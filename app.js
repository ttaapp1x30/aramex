require("dotenv").config();
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const logger = require("morgan");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const requestIp = require("request-ip");
const useragent = require("express-useragent");
const mongoose = require("mongoose");

const indexRouter = require("./routes/index");
const adminRouter = require("./routes/admin");

const app = express();
const port = 3000;

const Admin = require("./model/Admin");
const config = require("./config");

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

const store = new MongoDBStore({
  uri: require("./config").DATABASE_URL,
  collection: "sessions",
  expires: 20 * 60 * 1000,
  connectionOptions: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  },
});

const sessionMiddleware = session({
  secret: "097b0efb-0889-4060-bb08-4dc568eadb44",
  resave: false,
  saveUninitialized: true,
  store: store,
  cookie: {
    maxAge: 15 * 60 * 1000, // 1 hour
  },
});
app.use(sessionMiddleware);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(requestIp.mw());
app.use(useragent.express());

app.use("/admin", adminRouter);
app.use("/", indexRouter);

app.use((req, res, next) => {
  if (!req.session.admin) {
    return next();
  }

  Admin.findById(req.session.admin._id)
    .then((admin) => {
      req.admin = admin;
      next();
    })
    .catch((err) => {
      res.status(err.status);
      res.render("error");
    });
});

app.use((req, res, next) => {
  res.locals.isLoggedIn = req.session.isLoggedIn;
  res.locals.admin = req.admin;
  next();
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

mongoose
  .connect(config.DATABASE_URL)
  .then((connection) => {
    const server = app.listen(port);
    const io = require("./io").init(server);
    const wrap = (middleware) => (socket, next) =>
      middleware(socket.request, {}, next);

    io.use(wrap(sessionMiddleware));

    // mongoose.connection
    //   .collection("sessions")
    //   .watch()
    //   .on("change", async (data) => {
    //     // detecting change successfully
    //     io.emit("sessionUpdate", {
    //       updated: true,
    //       data: data,
    //     });
    //   });

    io.on("connection", async (socket) => {
      const uniqueID = socket.request.session.uniqueID;

      await mongoose.connection
        .collection("sessions")
        .updateOne(
          { "session.uniqueID": uniqueID }, // The search query
          { $set: { "session.status": true } } // The update operation
        )
        .then((result) => {
          io.emit("session-update", {
            updated: true,
          });
        });

      socket.on("disconnect", async (reason) => {
        await mongoose.connection
          .collection("sessions")
          .updateOne(
            { "session.uniqueID": uniqueID }, // The search query
            { $set: { "session.status": false, "session.page": "Left" } } // The update operation
          )
          .then((result) => {
            io.emit("session-update", {
              updated: true,
            });
          });
      });
    });
  })
  .catch((err) => {
    console.log(err);
  });
