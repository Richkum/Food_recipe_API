/**
 * @swagger
 * components:
 *   schemas:
 *     Recipe:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         title:
 *           type: string
 *         instructions:
 *           type: string
 *         imageUrl:
 *           type: string
 *         categoryId:
 *           type: integer
 *         ingredients:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Ingredient'
 *     NewRecipe:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *         instructions:
 *           type: string
 *         imageUrl:
 *           type: string
 *         categoryId:
 *           type: integer
 *         ingredients:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Ingredient'
 *     Ingredient:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *         quantity:
 *           type: number
 *         unit:
 *           type: string
 */
