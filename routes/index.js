import express from 'express';
import recipesRouter from './recipes.js';
import categoriesRouter from './categories.js';
import ingredientsRouter from './ingredients.js';
import tagsRouter from './tags.js';

const router = express.Router();

router.use('/recipes', recipesRouter);
router.use('/categories', categoriesRouter);
router.use('/ingredients', ingredientsRouter);
router.use('/tags', tagsRouter);

export default router;
