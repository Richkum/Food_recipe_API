import express from "express";
import { body, validationResult } from "express-validator";
// import multer from 'multer';
// import { CloudinaryStorage } from 'multer-storage-cloudinary';
import pool from "../db.config/index.js";
// import cloudinary from '../cloud.config/cloudinary.js';

const router = express.Router();
/**
 * // Configure multer-storage-cloudinary
// const storage = new CloudinaryStorage({
//   cloudinary,
//   params: {
//     folder: 'recipes',
//     allowed_formats: ['jpg', 'jpeg', 'png'],
//   },
// });

// const upload = multer({ storage });
 */
// Middleware for handling validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

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
    return res.status(200).json(recipes);
  } catch (error) {
    next(error);
  }
});

// create a new recipe
// Create a new recipe
router.post(
  "/",
  [
    // Validation middleware
    body("title").notEmpty().withMessage("Title is required"),
    body("instructions").notEmpty().withMessage("Instructions are required"),
    body("imageUrl").isURL().withMessage("Image URL must be a valid URL"),
    body("categoryId").isInt().withMessage("Category ID must be an integer"),
    body("ingredients").isArray().withMessage("Ingredients must be an array"),
    body("ingredients.*.name")
      .notEmpty()
      .withMessage("Ingredient name is required"),
    body("ingredients.*.quantity")
      .isFloat({ gt: 0 })
      .withMessage("Ingredient quantity must be a positive number"),
    body("ingredients.*.unit")
      .notEmpty()
      .withMessage("Ingredient unit is required"),
    handleValidationErrors,
  ],
  async (req, res, next) => {
    let client;
    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const { title, instructions, imageUrl, categoryId, ingredients } =
        req.body;

      const insertRecipeQuery = `
        INSERT INTO recipes (title, instructions, image_url, category_id)
        VALUES (\$1, \$2, \$3, \$4)
        RETURNING recipe_id
      `;
      const {
        rows: [{ recipe_id: recipeId }],
      } = await client.query(insertRecipeQuery, [
        title,
        instructions,
        imageUrl,
        categoryId,
      ]);

      const ingredientPromises = ingredients.map(async (ingredient) => {
        const { name, quantity, unit } = ingredient;

        const insertIngredientQuery = `
          INSERT INTO ingredients (name)
          VALUES (\$1)
          ON CONFLICT (name) DO NOTHING
          RETURNING ingredient_id
        `;
        const { rows: ingredientRows } = await client.query(
          insertIngredientQuery,
          [name]
        );

        let ingredientId;
        if (ingredientRows.length > 0) {
          ingredientId = ingredientRows[0].ingredient_id;
        } else {
          const selectIngredientQuery =
            "SELECT ingredient_id FROM ingredients WHERE name = $1";
          const { rows: existingIngredientRows } = await client.query(
            selectIngredientQuery,
            [name]
          );
          ingredientId = existingIngredientRows[0].ingredient_id;
        }

        const insertRecipeIngredientQuery = `
          INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
          VALUES (\$1, \$2, \$3, \$4)
        `;
        await client.query(insertRecipeIngredientQuery, [
          recipeId,
          ingredientId,
          quantity,
          unit,
        ]);
      });

      await Promise.all(ingredientPromises);

      await client.query("COMMIT");

      return res.status(201).json({ recipeId });
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
  }
);

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

    return recipes.length === 0
      ? res.status(404).json({ error: "Recipe not found" })
      : res.json(recipes[0]);
  } catch (error) {
    next(error);
  }
});

// Update a recipe
router.put(
  "/:id",
  [
    // Validate input
    body("title").notEmpty().withMessage("Title is required"),
    body("instructions").notEmpty().withMessage("Instructions are required"),
    body("imageUrl").isURL().withMessage("Image URL must be a valid URL"),
    body("categoryId").isInt().withMessage("Category ID must be an integer"),
    body("ingredients").isArray().withMessage("Ingredients must be an array"),
    body("ingredients.*.name")
      .notEmpty()
      .withMessage("Ingredient name is required"),
    body("ingredients.*.quantity")
      .isFloat({ gt: 0 })
      .withMessage("Ingredient quantity must be a positive number"),
    body("ingredients.*.unit")
      .notEmpty()
      .withMessage("Ingredient unit is required"),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    let client;
    try {
      client = await pool.connect();
      const { id } = req.params;
      const { title, instructions, imageUrl, categoryId, ingredients } =
        req.body;

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
        imageUrl,
        categoryId,
        id,
      ]);

      if (ingredients && ingredients.length > 0) {
        await client.query(
          "DELETE FROM recipe_ingredients WHERE recipe_id = $1",
          [id]
        );

        const ingredientPromises = ingredients.map(async (ingredient) => {
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

          let ingredientId;
          if (ingredientRows.length > 0) {
            ingredientId = ingredientRows[0].ingredient_id;
          } else {
            const selectIngredientQuery =
              "SELECT ingredient_id FROM ingredients WHERE name = $1";
            const { rows: existingIngredientRows } = await client.query(
              selectIngredientQuery,
              [name]
            );
            ingredientId = existingIngredientRows[0].ingredient_id;
          }

          const insertRecipeIngredientQuery = `
            INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
            VALUES ($1, $2, $3, $4)
          `;
          await client.query(insertRecipeIngredientQuery, [
            id,
            ingredientId,
            quantity,
            unit,
          ]);
        });

        await Promise.all(ingredientPromises);
      }

      await client.query("COMMIT");

      res.json({ message: "Recipe and ingredients updated successfully" });
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
  }
);

// Delete a recipe
router.delete("/:id", async (req, res, next) => {
  let client;
  try {
    client = await pool.connect();
    const { id } = req.params;

    await client.query("BEGIN");

    const deleteRecipeIngredientsQuery =
      "DELETE FROM recipe_ingredients WHERE recipe_id = $1";
    await client.query(deleteRecipeIngredientsQuery, [id]);

    const deleteRecipeQuery = "DELETE FROM recipes WHERE recipe_id = $1";
    const result = await client.query(deleteRecipeQuery, [id]);

    await client.query("COMMIT");

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Recipe not found" });
    }

    return res.json({ message: "Recipe deleted successfully" });
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
      WHERE r.category_id = \$1
      GROUP BY r.recipe_id
    `;
    const { rows: recipes } = await pool.query(query, [id]);

    if (recipes.length === 0) {
      return res
        .status(404)
        .json({ error: "No recipes found for this category" });
    }

    return res.json(recipes);
  } catch (error) {
    next(error);
  }
});

export default router;
