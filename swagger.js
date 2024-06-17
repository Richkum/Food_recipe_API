import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const swaggerOptions = {
  swaggerDefinition: {
    info: {
      title: 'Food Recipe API',
      version: '1.0.0',
      description: 'API for managing food recipes',
      contact: {
        name: 'Your Name',
        email: 'your.email@example.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
  },
  apis: ['./routes/*.js'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);

export default (app) => {
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));
};
