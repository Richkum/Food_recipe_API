import express from "express";
import pool from "../../db.config/index.js";

const router = express.Router();

// GET /recipes

router.get("/recipes", async (request, response, next) => {
  try {
    const query = "SELECT * FROM recipes";

    const { rows: recipes } = await pool.query(query);

    response.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
});

//POST / recipes
router.post("/recipes", async (req, res, next) => {
  try {
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    const recipeQuery = `
      INSERT INTO recipes (title, instructions, image_url, category_id) 
      VALUES ($1, $2, $3, $4) 
      RETURNING recipe_id
    `;
    const recipeValues = [title, instructions, image_url, category_id];
    console.log("Recipe insert query:", recipeQuery, "Values:", recipeValues);
    const {
      rows: [recipe],
    } = await pool.query(recipeQuery, recipeValues);
    console.log("Inserted recipe:", recipe);

    const ingredientIdsQuery = `
      SELECT ingredient_id FROM ingredients WHERE name = ANY($1)
    `;
    console.log(
      "Ingredient IDs query:",
      ingredientIdsQuery,
      "Ingredients:",
      ingredients
    );
    const { rows: ingredientIds } = await pool.query(ingredientIdsQuery, [
      ingredients,
    ]);
    console.log("Retrieved ingredient IDs:", ingredientIds);

    const insertIngredientsQuery = `
      INSERT INTO recipe_ingredients (recipe_id, ingredient_id) 
      VALUES ($1, $2)
    `;
    for (const ingredientId of ingredientIds) {
      console.log(
        "Inserting recipe ingredient:",
        recipe.recipe_id,
        ingredientId.ingredient_id
      );
      await pool.query(insertIngredientsQuery, [
        recipe.recipe_id,
        ingredientId.ingredient_id,
      ]);
    }

    res.status(201).json(recipe);
  } catch (error) {
    console.error("Error adding recipe:", error);
    res.status(500).json({ error: "An unexpected error occurred." });
  }
});

// GET /recipes/:id
router.get("/recipes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const { rows: recipes } = await pool.query(
      "SELECT * FROM recipes WHERE recipe_id = $1",
      [id]
    );

    if (recipes.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    const { rows: ingredients } = await pool.query(
      `SELECT i.name 
       FROM recipe_ingredients ri
       JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
       WHERE ri.recipe_id = $1`,
      [id]
    );

    const ingredientNames = ingredients.map((ingredient) => ingredient.name);

    const recipe = {
      ...recipes[0],
      ingredients: ingredientNames,
    };

    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// PUT /recipes/:id
router.put("/recipes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    if (!title || !instructions || !category_id || !ingredients) {
      return res.status(400).json({
        error: "Title, instructions, category ID, and ingredients are required",
      });
    }

    await pool.query(
      `
      UPDATE recipes SET 
        title = $1, 
        instructions = $2, 
        image_url = $3, 
        category_id = $4, 
        updated_at = CURRENT_TIMESTAMP 
      WHERE recipe_id = $5
    `,
      [title, instructions, image_url, category_id, id]
    );

    await pool.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [
      id,
    ]);

    const ingredientValues = ingredients.map((ingredient) => [
      id,
      ingredient.name,
      ingredient.quantity,
    ]);
    await pool.query(
      `
      INSERT INTO recipe_ingredients (recipe_id, ingredient_name, quantity) 
      VALUES ${ingredientValues.map(() => "( $1, $2, $3 )").join(", ")}
    `,
      ingredientValues.flat()
    );

    res.json({ message: "Recipe and ingredients updated successfully" });
  } catch (error) {
    next(error);
  }
});

// DELETE /recipes/:id

router.delete("/recipes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      "DELETE FROM recipes WHERE recipe_id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// GET /recipes/category/:categoryId
router.get("/recipes/category/:categoryId", async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    const query = `
      SELECT * FROM recipes
      WHERE category_id = $1
    `;
    const { rows: recipes } = await pool.query(query, [categoryId]);

    if (recipes.length === 0) {
      return res
        .status(404)
        .json({ error: "No recipes found for the given category" });
    }

    res.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
});

export default router;
