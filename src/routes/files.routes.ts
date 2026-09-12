import { Router } from "express";
import multer from "multer";
import bytes from "bytes";
import { config } from "../config";
import { methodNotAllowedHandler } from "../middleware/methodNotAllowed";
import * as fileController from "../controllers/file.controller";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: bytes.parse(config.maxFileSize) as number },
});

export const filesRouter = Router({ strict: true });

filesRouter.post("/files", upload.single("upload"), fileController.postFile);
filesRouter.get("/files", fileController.getFiles);
filesRouter.all("/files", methodNotAllowedHandler);

filesRouter.get("/files/:id", fileController.getFileById);
filesRouter.delete("/files/:id", fileController.deleteFileById);
filesRouter.all("/files/:id", methodNotAllowedHandler);
