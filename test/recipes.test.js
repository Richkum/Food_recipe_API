import request from "supertest";
import app from "../app";
import pool from "../db.config/index.js";

jest.mock("../db.config/index.js");

describe("Recipes API", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch all recipes", async () => {
    const mockRecipes = [
      { recipe_id: 1, title: "Recipe 1", instructions: "Instructions 1" },
    ];
    pool.query.mockResolvedValue({ rows: mockRecipes });

    const response = await request(app).get("/recipes");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockRecipes);
  });

  it("should create a new recipe", async () => {
    const newRecipe = {
      title: "Recipe 2",
      instructions: "Instructions 2",
      image_url: "http://example.com/image2.jpg",
      category_id: 1,
      ingredients: ["Ingredient 1", "Ingredient 2"],
    };
    pool.query.mockResolvedValueOnce({ rows: [{ recipe_id: 2 }] });

    const response = await request(app).post("/recipes").send(newRecipe);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty("recipe_id");
  });

  it("should fetch a recipe by id", async () => {
    const mockRecipe = {
      recipe_id: 1,
      title: "Recipe 1",
      instructions: "Instructions 1",
      category_id: 1,
      ingredients: ["Ingredient 1", "Ingredient 2"],
    };
    pool.query.mockResolvedValueOnce({ rows: [mockRecipe] });
    pool.query.mockResolvedValueOnce({
      rows: [{ name: "Ingredient 1" }, { name: "Ingredient 2" }],
    });

    const response = await request(app).get("/recipes/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockRecipe);
  });

  it("should update a recipe", async () => {
    const updatedRecipe = {
      title: "Updated Recipe",
      instructions: "Updated Instructions",
      image_url: "http://example.com/image.jpg",
      category_id: 1,
      ingredients: ["Ingredient 1", "Ingredient 2"],
    };
    pool.query.mockResolvedValueOnce({ rowCount: 1 });
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app).put("/recipes/1").send(updatedRecipe);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "Recipe and ingredients updated successfully"
    );
  });

  it("should delete a recipe", async () => {
    pool.query.mockResolvedValueOnce({ rowCount: 1 });

    const response = await request(app).delete("/recipes/1");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty(
      "message",
      "Recipe deleted successfully"
    );
  });

  it("should fetch recipes by category id", async () => {
    const mockRecipes = [
      {
        recipe_id: 1,
        title: "Recipe 1",
        instructions: "Instructions 1",
        category_id: 1,
      },
    ];
    pool.query.mockResolvedValue({ rows: mockRecipes });

    const response = await request(app).get("/recipes/category/1");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(mockRecipes);
  });
});
