import express from "express";
import pool from "../../db.config/index.js";

const router = express.Router();

// GET /recipes

router.get("/", async (request, response, next) => {
  try {
    const query = "SELECT * FROM recipes";

    const { rows: recipes } = await pool.query(query);

    response.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
});

//POST / recipes

router.post("/", async (req, res, next) => {
  const { title, instructions, image_url, category_id, ingredients } = req.body;

  if (
    !title ||
    !instructions ||
    !category_id ||
    !ingredients ||
    ingredients.length === 0
  ) {
    return res.status(400).json({
      error:
        "Title, instructions, category_id, and at least one ingredient are required",
    });
  }

  try {
    const query = `
      INSERT INTO recipes (title, instructions, image_url, category_id) VALUES 
      ($1, $2, $3, $4) RETURNING id
    `;
    const values = [title, instructions, image_url, category_id];

    const { rows: recipe } = await pool.query(query, values);

    const ingredientQuery = `
      INSERT INTO recipe_ingredients (recipe_id, ingredient_name) VALUES 
      ($1, $2)
    `;
    for (const ingredient of ingredients) {
      await pool.query(ingredientQuery, [recipe[0].id, ingredient]);
    }

    res.status(201).json(recipe);
  } catch (error) {
    next(error);
  }
});

// GET /recipes/:id

router.get("/:id", async (req, res, next) => {
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
      "SELECT ingredient_name FROM recipe_ingredients WHERE recipe_id = $1",
      [id]
    );

    const recipe = {
      ...recipes[0],
      ingredients: ingredients.map((ingredient) => ingredient.ingredient_name),
    };

    res.json(recipe);
  } catch (error) {
    next(error);
  }
});

// PUT /recipes/:id

router.put("/:id", async (req, res, next) => {
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

router.delete("/:id", async (req, res, next) => {
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

export default router;
