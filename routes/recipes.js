import express from "express";
import pool from "../db.config/index.js";
import cloudinary from "../cloud.config/cloudinary.js";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const router = express.Router();

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "recipes",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

const upload = multer({ storage });

// Fetch all recipes
router.get("/", async (req, res, next) => {
  try {
    const query = `
      SELECT r.recipe_id, r.title, r.instructions, r.image_url, r.category_id, r.created_at, r.updated_at,
             json_agg(json_build_object('name', i.name, 'quantity', ri.quantity, 'unit', ri.unit)) as ingredients
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON r.recipe_id = ri.recipe_id
      LEFT JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
      GROUP BY r.recipe_id
    `;
    const { rows: recipes } = await pool.query(query);
    res.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
});

// Create a new recipe
router.post("/", async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    await client.query("BEGIN");

    const insertRecipeQuery = `
      INSERT INTO recipes (title, instructions, image_url, category_id)
      VALUES ($1, $2, $3, $4)
      RETURNING recipe_id
    `;
    const {
      rows: [{ recipe_id }],
    } = await client.query(insertRecipeQuery, [
      title,
      instructions,
      image_url,
      category_id,
    ]);

    for (const ingredient of ingredients) {
      const { name, quantity, unit } = ingredient;

      const insertIngredientQuery = `
        INSERT INTO ingredients (name)
        VALUES ($1)
        ON CONFLICT (name) DO NOTHING
        RETURNING ingredient_id
      `;
      const { rows: ingredientRows } = await client.query(
        insertIngredientQuery,
        [name]
      );

      let ingredient_id;
      if (ingredientRows.length > 0) {
        ingredient_id = ingredientRows[0].ingredient_id;
      } else {
        const selectIngredientQuery =
          "SELECT ingredient_id FROM ingredients WHERE name = $1";
        const { rows: existingIngredientRows } = await client.query(
          selectIngredientQuery,
          [name]
        );
        ingredient_id = existingIngredientRows[0].ingredient_id;
      }

      const insertRecipeIngredientQuery = `
        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
        VALUES ($1, $2, $3, $4)
      `;
      await client.query(insertRecipeIngredientQuery, [
        recipe_id,
        ingredient_id,
        quantity,
        unit,
      ]);
    }

    await client.query("COMMIT");

    res.status(201).json({ recipe_id });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

// Fetch a recipe by ID
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT r.recipe_id, r.title, r.instructions, r.image_url, r.category_id, r.created_at, r.updated_at,
             json_agg(json_build_object('name', i.name, 'quantity', ri.quantity, 'unit', ri.unit)) as ingredients
      FROM recipes r
      LEFT JOIN recipe_ingredients ri ON r.recipe_id = ri.recipe_id
      LEFT JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
      WHERE r.recipe_id = $1
      GROUP BY r.recipe_id
    `;
    const { rows: recipes } = await pool.query(query, [id]);

    if (recipes.length === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json(recipes[0]);
  } catch (error) {
    next(error);
  }
});

// Update a recipe
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    const updateRecipeQuery = `
      UPDATE recipes SET 
        title = $1, 
        instructions = $2, 
        image_url = $3, 
        category_id = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE recipe_id = $5
    `;
    await pool.query(updateRecipeQuery, [
      title,
      instructions,
      image_url,
      category_id,
      id,
    ]);

    if (ingredients && ingredients.length > 0) {
      await pool.query(`DELETE FROM recipe_ingredients WHERE recipe_id = $1`, [
        id,
      ]);

      const ingredientQueries = ingredients.map((ingredient) => {
        const { name, quantity, unit } = ingredient;
        return pool.query(
          `INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit) 
          VALUES ($1, (SELECT ingredient_id FROM ingredients WHERE name = $2), $3, $4)`,
          [id, name, quantity, unit]
        );
      });
      await Promise.all(ingredientQueries);
    }

    res.json({ message: "Recipe and ingredients updated successfully" });
  } catch (error) {
    next(error);
  }
});

// Delete a recipe
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteQuery = `DELETE FROM recipes WHERE recipe_id = $1`;
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    next(error);
  }
});

// Fetch recipes by category ID
router.get("/category/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT r.recipe_id, r.title, r.instructions, r.image_url, r.category_id, 
             array_agg(i.name) AS ingredients
      FROM recipes r
      JOIN recipe_ingredients ri ON r.recipe_id = ri.recipe_id
      JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
      WHERE r.category_id = $1
      GROUP BY r.recipe_id
    `;
    const { rows: recipes } = await pool.query(query, [id]);

    if (recipes.length === 0) {
      return res
        .status(404)
        .json({ error: "No recipes found for this category" });
    }

    res.json(recipes);
  } catch (error) {
    next(error);
  }
});

export default router;
