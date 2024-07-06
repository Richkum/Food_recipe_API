import express from "express";
import { body, validationResult } from "express-validator";
import pool from "../db.config/index.js";

const router = express.Router();

// Middleware for handling validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Fetch all recipes
/**
 * @swagger
 * /recipes:
 *   get:
 *     summary: Get all recipes
 *     description: Retrieve a list of all recipes.
 *     responses:
 *       200:
 *         description: A list of recipes
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Recipe'
 */
router.get("/", (req, res, next) => {
  const query = `
    SELECT r.recipe_id, r.title, r.instructions, r.image_url, r.category_id, r.created_at, r.updated_at,
           json_agg(json_build_object('name', i.name, 'quantity', ri.quantity, 'unit', ri.unit)) as ingredients
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.recipe_id = ri.recipe_id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
    GROUP BY r.recipe_id
  `;

  pool.query(query, (error, results) => {
    if (error) {
      next(error);
      return;
    }

    res.status(200).json(results.rows);
  });
});

// Fetch a recipe by ID
/**
 * @swagger
 * /recipes/{id}:
 *   get:
 *     summary: Get a recipe by ID
 *     description: Retrieve a recipe by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The recipe ID
 *     responses:
 *       200:
 *         description: A single recipe
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Recipe'
 *       404:
 *         description: Recipe not found
 */
router.get("/:id", (req, res, next) => {
  const { id } = req.params;
  const query = `
    SELECT r.recipe_id, r.title, r.instructions, r.image_url, r.category_id, r.created_at, r.updated_at,
           json_agg(json_build_object('name', i.name, 'quantity', ri.quantity, 'unit', ri.unit)) as ingredients
    FROM recipes r
    LEFT JOIN recipe_ingredients ri ON r.recipe_id = ri.recipe_id
    LEFT JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
    WHERE r.recipe_id = \$1
    GROUP BY r.recipe_id
  `;

  pool.query(query, [id], (error, results) => {
    if (error) {
      next(error);
      return;
    }

    const recipes = results.rows;
    if (recipes.length === 0) {
      res.status(404).json({ error: "Recipe not found" });
    } else {
      res.json(recipes[0]);
    }
  });
});

// Fetch recipes by category ID
/**
 * @swagger
 * /recipes/category/{categoryId}:
 *   get:
 *     summary: Get recipes by category ID
 *     description: Retrieve all recipes that belong to a specific category.
 *     parameters:
 *       - in: path
 *         name: categoryId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The category ID
 *     responses:
 *       200:
 *         description: List of recipes in the specified category
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Recipe'
 *       404:
 *         description: No recipes found for the specified category
 */
router.get("/category/:id", (req, res, next) => {
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

  pool.query(query, [id], (error, results) => {
    if (error) {
      next(error);
      return;
    }

    const recipes = results.rows;
    if (recipes.length === 0) {
      res.status(404).json({ error: "No recipes found for this category" });
    } else {
      res.json(recipes);
    }
  });
});

// Create a new recipe
/**
 * @swagger
 * /recipes:
 *   post:
 *     summary: Create a new recipe
 *     description: Add a new recipe to the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewRecipe'
 *     responses:
 *       201:
 *         description: Recipe created successfully
 */
router.post(
  "/",
  [
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
  (req, res, next) => {
    pool.connect((err, client, done) => {
      if (err) return next(err);

      client.query("BEGIN", (err) => {
        if (err) {
          done();
          return next(err);
        }

        const { title, instructions, imageUrl, categoryId, ingredients } =
          req.body;

        const insertRecipeQuery = `
          INSERT INTO recipes (title, instructions, image_url, category_id)
          VALUES ($1, $2, $3, $4)
          RETURNING recipe_id
        `;
        client.query(
          insertRecipeQuery,
          [title, instructions, imageUrl, categoryId],
          (err, result) => {
            if (err) {
              client.query("ROLLBACK", (err) => {
                done();
                if (err) return next(err);
                return next(err);
              });
            } else {
              const { recipe_id: recipeId } = result.rows[0];

              const ingredientPromises = ingredients.map((ingredient) => {
                return new Promise((resolve, reject) => {
                  const { name, quantity, unit } = ingredient;

                  const insertIngredientQuery = `
                  INSERT INTO ingredients (name)
                  VALUES ($1)
                  ON CONFLICT (name) DO NOTHING
                  RETURNING ingredient_id
                `;
                  client.query(insertIngredientQuery, [name], (err, result) => {
                    if (err) return reject(err);

                    let ingredientId;
                    if (result.rows.length > 0) {
                      ingredientId = result.rows[0].ingredient_id;
                    } else {
                      const selectIngredientQuery =
                        "SELECT ingredient_id FROM ingredients WHERE name = $1";
                      client.query(
                        selectIngredientQuery,
                        [name],
                        (err, result) => {
                          if (err) return reject(err);
                          ingredientId = result.rows[0].ingredient_id;

                          const insertRecipeIngredientQuery = `
                        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                        VALUES ($1, $2, $3, $4)
                      `;
                          client.query(
                            insertRecipeIngredientQuery,
                            [recipeId, ingredientId, quantity, unit],
                            (err) => {
                              if (err) return reject(err);
                              resolve();
                            }
                          );
                        }
                      );
                    }

                    const insertRecipeIngredientQuery = `
                    INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                    VALUES ($1, $2, $3, $4)
                  `;
                    client.query(
                      insertRecipeIngredientQuery,
                      [recipeId, ingredientId, quantity, unit],
                      (err) => {
                        if (err) return reject(err);
                        resolve();
                      }
                    );
                  });
                });
              });

              Promise.all(ingredientPromises)
                .then(() => {
                  client.query("COMMIT", (err) => {
                    if (err) {
                      client.query("ROLLBACK", (err) => {
                        done();
                        if (err) return next(err);
                        return next(err);
                      });
                    } else {
                      done();
                      return res.status(201).json({ recipeId });
                    }
                  });
                })
                .catch((err) => {
                  client.query("ROLLBACK", (err) => {
                    done();
                    if (err) return next(err);
                    return next(err);
                  });
                });
            }
          }
        );
      });
    });
  }
);

// Update a recipe
/**
 * @swagger
 * /recipes/{id}:
 *   put:
 *     summary: Update a recipe
 *     description: Update the details of an existing recipe.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The recipe ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NewRecipe'
 *     responses:
 *       200:
 *         description: Recipe updated successfully
 *       404:
 *         description: Recipe not found
 */
router.put(
  "/:id",
  [
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
  (req, res, next) => {
    pool.connect((err, client, done) => {
      if (err) return next(err);

      const { id } = req.params;
      const { title, instructions, imageUrl, categoryId, ingredients } =
        req.body;

      client.query("BEGIN", (err) => {
        if (err) {
          done();
          return next(err);
        }

        const updateRecipeQuery = `
          UPDATE recipes SET 
            title = $1, 
            instructions = $2, 
            image_url = $3, 
            category_id = $4,
            updated_at = CURRENT_TIMESTAMP
          WHERE recipe_id = $5
        `;
        client.query(
          updateRecipeQuery,
          [title, instructions, imageUrl, categoryId, id],
          (err) => {
            if (err) {
              client.query("ROLLBACK", (err) => {
                done();
                if (err) return next(err);
                return next(err);
              });
            } else {
              if (ingredients && ingredients.length > 0) {
                client.query(
                  "DELETE FROM recipe_ingredients WHERE recipe_id = $1",
                  [id],
                  (err) => {
                    if (err) {
                      client.query("ROLLBACK", (err) => {
                        done();
                        if (err) return next(err);
                        return next(err);
                      });
                    } else {
                      const ingredientPromises = ingredients.map(
                        (ingredient) => {
                          return new Promise((resolve, reject) => {
                            const { name, quantity, unit } = ingredient;

                            const insertIngredientQuery = `
                              INSERT INTO ingredients (name)
                              VALUES ($1)
                              ON CONFLICT (name) DO NOTHING
                              RETURNING ingredient_id
                            `;
                            client.query(
                              insertIngredientQuery,
                              [name],
                              (err, result) => {
                                if (err) return reject(err);

                                let ingredientId;
                                if (result.rows.length > 0) {
                                  ingredientId = result.rows[0].ingredient_id;
                                } else {
                                  const selectIngredientQuery =
                                    "SELECT ingredient_id FROM ingredients WHERE name = $1";
                                  client.query(
                                    selectIngredientQuery,
                                    [name],
                                    (err, result) => {
                                      if (err) return reject(err);
                                      ingredientId =
                                        result.rows[0].ingredient_id;

                                      const insertRecipeIngredientQuery = `
                                        INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                                        VALUES ($1, $2, $3, $4)
                                      `;
                                      client.query(
                                        insertRecipeIngredientQuery,
                                        [id, ingredientId, quantity, unit],
                                        (err) => {
                                          if (err) return reject(err);
                                          resolve();
                                        }
                                      );
                                    }
                                  );
                                }

                                const insertRecipeIngredientQuery = `
                                  INSERT INTO recipe_ingredients (recipe_id, ingredient_id, quantity, unit)
                                  VALUES ($1, $2, $3, $4)
                                `;
                                client.query(
                                  insertRecipeIngredientQuery,
                                  [id, ingredientId, quantity, unit],
                                  (err) => {
                                    if (err) return reject(err);
                                    resolve();
                                  }
                                );
                              }
                            );
                          });
                        }
                      );

                      Promise.all(ingredientPromises)
                        .then(() => {
                          client.query("COMMIT", (err) => {
                            if (err) {
                              client.query("ROLLBACK", (err) => {
                                done();
                                if (err) return next(err);
                                return next(err);
                              });
                            } else {
                              done();
                              res.json({
                                message:
                                  "Recipe and ingredients updated successfully",
                              });
                            }
                          });
                        })
                        .catch((err) => {
                          client.query("ROLLBACK", (err) => {
                            done();
                            if (err) return next(err);
                            return next(err);
                          });
                        });
                    }
                  }
                );
              } else {
                client.query("COMMIT", (err) => {
                  if (err) {
                    client.query("ROLLBACK", (err) => {
                      done();
                      if (err) return next(err);
                      return next(err);
                    });
                  } else {
                    done();
                    res.json({
                      message: "Recipe updated successfully",
                    });
                  }
                });
              }
            }
          }
        );
      });
    });
  }
);

// Delete a recipe
/**
 * @swagger
 * /recipes/{id}:
 *   delete:
 *     summary: Delete a recipe
 *     description: Delete a recipe from the database by its ID.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the recipe to delete
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Recipe deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Recipe deleted successfully
 *       404:
 *         description: Recipe not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Recipe not found
 */
router.delete("/:id", (req, res, next) => {
  const { id } = req.params;

  pool.query(
    "DELETE FROM recipes WHERE recipe_id = $1",
    [id],
    (error, result) => {
      if (error) {
        next(error);
        return;
      }

      if (result.rowCount === 0) {
        res.status(404).json({ error: "Recipe not found" });
      } else {
        res.json({ message: "Recipe deleted successfully" });
      }
    }
  );
});

export default router;
