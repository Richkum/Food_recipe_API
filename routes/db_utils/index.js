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

    // Insert recipe into the recipes table and retrieve the assigned recipe_id
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

    // Retrieve ingredient IDs based on ingredient names
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

    // Insert recipe ingredients into the recipe_ingredients table
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

    // Fetch recipe details from the recipes table
    const { rows: recipes } = await pool.query(
      "SELECT * FROM recipes WHERE recipe_id = $1",
      [id]
    );

    // Check if the recipe exists
    if (recipes.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Fetch ingredients associated with the recipe from the recipe_ingredients table
    const { rows: ingredients } = await pool.query(
      `SELECT i.name 
       FROM recipe_ingredients ri
       JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
       WHERE ri.recipe_id = $1`,
      [id]
    );

    // Extract ingredient names from the query result
    const ingredientNames = ingredients.map((ingredient) => ingredient.name);

    // Construct the recipe object with ingredients
    const recipe = {
      ...recipes[0], // Get the first (and only) recipe from the query result
      ingredients: ingredientNames,
    };

    // Send the recipe object as JSON response
    res.json(recipe);
  } catch (error) {
    next(error); // Pass any errors to the error handling middleware
  }
});

// PUT /recipes/:id
router.put("/recipes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    // Check if required fields are provided
    if (!title || !instructions || !category_id || !ingredients) {
      return res.status(400).json({
        error: "Title, instructions, category ID, and ingredients are required",
      });
    }

    // Update recipe details in the recipes table
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

    // Delete existing ingredients associated with the recipe
    await pool.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [
      id,
    ]);

    // Insert new ingredients into the recipe_ingredients table
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
    next(error); // Pass any errors to the error handling middleware
  }
});

// DELETE /recipes/:id

router.delete("/recipes/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Delete recipe from the recipes table
    const result = await pool.query(
      "DELETE FROM recipes WHERE recipe_id = $1",
      [id]
    );

    // Check if the recipe was found and deleted
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    // Optionally, you can delete associated ingredients from the recipe_ingredients table here

    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    next(error); // Pass any errors to the error handling middleware
  }
});

// GET /recipes/category/:categoryId
router.get("/recipes/category/:categoryId", async (req, res, next) => {
  try {
    const { categoryId } = req.params;

    // Fetch recipes from the recipes table based on category ID
    const query = `
      SELECT * FROM recipes
      WHERE category_id = $1
    `;
    const { rows: recipes } = await pool.query(query, [categoryId]);

    // Check if any recipes were found for the given category ID
    if (recipes.length === 0) {
      return res
        .status(404)
        .json({ error: "No recipes found for the given category" });
    }

    res.status(200).json(recipes);
  } catch (error) {
    next(error); // Pass any errors to the error handling middleware
  }
});

export default router;
