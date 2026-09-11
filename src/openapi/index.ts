import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Router } from "express";
import yaml from "js-yaml";
import swaggerUi from "swagger-ui-express";

const openapiPath = join(__dirname, "..", "..", "openapi.yaml");
const openapiYamlText = readFileSync(openapiPath, "utf-8");
const openapiDocument = yaml.load(openapiYamlText) as Record<string, unknown>;

export const openapiRouter = Router();

openapiRouter.get("/openapi.yaml", (_req, res) => {
  res.type("text/yaml").send(openapiYamlText);
});

openapiRouter.get("/openapi.json", (_req, res) => {
  res.status(200).json(openapiDocument);
});

openapiRouter.use("/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));
