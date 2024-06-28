import express from "express";
import recipesRouter from "./recipes.js";

const router = express.Router();

router.use("/recipes", recipesRouter);

export default router;
