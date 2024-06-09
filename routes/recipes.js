import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import pool from "../db.config/index.js";
import cloudinary from "../cloud.config/cloudinary.js";

const router = express.Router();

// Configure multer-storage-cloudinary
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "recipes",
    allowed_formats: ["jpg", "jpeg", "png"],
  },
});

const upload = multer({ storage });
/**
 * @swagger
 * /recipes:
 *   get:
 *     summary: Get all recipes
 *     tags: [Recipes]
 *     responses:
 *       200:
 *         description: A list of recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   recipe_id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   instructions:
 *                     type: string
 *                   image_url:
 *                     type: string
 *                   category_id:
 *                     type: integer
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *                   ingredients:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         quantity:
 *                           type: number
 *                         unit:
 *                           type: string
 */

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

/**
 * @swagger
 * /recipes:
 *   post:
 *     summary: Create a new recipe
 *     tags: [Recipes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - instructions
 *               - category_id
 *               - ingredients
 *             properties:
 *               title:
 *                 type: string
 *               instructions:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *     responses:
 *       201:
 *         description: Recipe created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipe_id:
 *                   type: integer
 */

// Create a new recipe
router.post("/", async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    // Start transaction
    await client.query("BEGIN");

    // Insert into recipes table
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

    // Insert into ingredients and recipe_ingredients tables
    for (const ingredient of ingredients) {
      const { name, quantity, unit } = ingredient;

      // Insert ingredient into ingredients table (if it doesn't already exist)
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
        // Ingredient was newly inserted, get the new ingredient_id
        ingredient_id = ingredientRows[0].ingredient_id;
      } else {
        // Ingredient already exists, fetch the existing ingredient_id
        const selectIngredientQuery =
          "SELECT ingredient_id FROM ingredients WHERE name = $1";
        const { rows: existingIngredientRows } = await client.query(
          selectIngredientQuery,
          [name]
        );
        ingredient_id = existingIngredientRows[0].ingredient_id;
      }

      // Insert into recipe_ingredients table
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

    // Commit transaction
    await client.query("COMMIT");

    res.status(201).json({ recipe_id });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK");
    }
    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
});

/**
 * @swagger
 * /recipes/{id}:
 *   get:
 *     summary: Get a recipe by ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The recipe ID
 *     responses:
 *       200:
 *         description: A recipe object
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 recipe_id:
 *                   type: integer
 *                 title:
 *                   type: string
 *                 instructions:
 *                   type: string
 *                 image_url:
 *                   type: string
 *                 category_id:
 *                   type: integer
 *                 created_at:
 *                   type: string
 *                   format: date-time
 *                 updated_at:
 *                   type: string
 *                   format: date-time
 *                 ingredients:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       unit:
 *                         type: string
 *       404:
 *         description: Recipe not found
 */

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

/**
 * @swagger
 * /recipes/{id}:
 *   put:
 *     summary: Update a recipe
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The recipe ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - instructions
 *               - category_id
 *               - ingredients
 *             properties:
 *               title:
 *                 type: string
 *               instructions:
 *                 type: string
 *               image_url:
 *                 type: string
 *               category_id:
 *                 type: integer
 *               ingredients:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     name:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unit:
 *                       type: string
 *     responses:
 *       200:
 *         description: Recipe updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                */

// Update a recipe
router.put("/:id", async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const { id } = req.params;
    const { title, instructions, image_url, category_id, ingredients } =
      req.body;

    // Start transaction
    await client.query("BEGIN");

    const updateRecipeQuery = `
      UPDATE recipes SET 
        title = $1, 
        instructions = $2, 
        image_url = $3, 
        category_id = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE recipe_id = $5
    `;
    await client.query(updateRecipeQuery, [
      title,
      instructions,
      image_url,
      category_id,
      id,
    ]);

    if (ingredients && ingredients.length > 0) {
      await client.query(
        "DELETE FROM recipe_ingredients WHERE recipe_id = $1",
        [id]
      );

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

        // Insert into recipe_ingredients table
        const insertRecipeIngredientQuery = `
          INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
          VALUES ($1, $2, $3, $4)
        `;
        await client.query(insertRecipeIngredientQuery, [
          id,
          ingredient_id,
          quantity,
          unit,
        ]);
      }
    }

    // Commit transaction
    await client.query("COMMIT");

    res.json({ message: "Recipe and ingredients updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /recipes/{id}:
 *   delete:
 *     summary: Delete a recipe
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The recipe ID
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 */

// Delete a recipe
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleteQuery = "DELETE FROM recipes WHERE recipe_id = $1";
    const result = await pool.query(deleteQuery, [id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    res.json({ message: "Recipe deleted successfully" });
  } catch (error) {
    next(error);
  }
});

/**
 * @swagger
 * /recipes/category/{id}:
 *   get:
 *     summary: Get recipes by category ID
 *     tags: [Recipes]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: The category ID
 *     responses:
 *       200:
 *         description: A list of recipes in the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   recipe_id:
 *                     type: integer
 *                   title:
 *                     type: string
 *                   instructions:
 *                     type: string
 *                   image_url:
 *                     type: string
 *                   category_id:
 *                     type: integer
 *                   created_at:
 *                     type: string
 *                     format: date-time
 *                   updated_at:
 *                     type: string
 *                     format: date-time
 *                   ingredients:
 *                     type: array
 *                     items:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         quantity:
 *                           type: number
 *                         unit:
 *                           type: string
 *       404:
 *         description: No recipes found for this category
 *       500:
 *         description: Server error
 */

// Fetch recipes by category ID
router.get("/category/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = `
      SELECT 
        r.recipe_id, r.title, r.instructions, r.image_url, r.category_id, 
        r.created_at, r.updated_at,
        json_agg(
          json_build_object(
            'name', i.name,
            'quantity', ri.quantity,
            'unit', ri.unit
          )
        ) AS ingredients
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
