import swaggerJsDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0", // Ensure you are using OpenAPI 3.0
    info: {
      title: "Food Recipe API",
      version: "1.0.0",
      description: "API for managing food recipes",
      contact: {
        name: "Atum",
        email: "theseniorman237.email@gmail.com",
      },
    },
    servers: [
      {
        url: "http://localhost:3000",
      },
    ],
  },
  apis: ["./routes/*.js", "./swaggerSchemas.js"], // Ensure this path is correct
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export default (app) => {
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};
