import express from "express";
import cookieParser from "cookie-parser";
import logger from "morgan";

import recipeRouter from "./routes/index.js";
import swagger from "./swagger.js";

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use("/recipes", recipeRouter);

// Initialize Swagger
swagger(app);

app.use("/", recipeRouter);

// catch 404 and forward to error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

// error handler
app.use((err, req, res) => {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.json({ err: err.message });
});

export default app;
