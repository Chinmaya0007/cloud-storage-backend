import { Router } from "express";
import multer from "multer";
import {
  createFolder,
  renameFolder,
  deleteFile,
  deleteFolder,
  listItems,
  saveFileMeta,
  uploadFile,  // ✅ new controller
} from "../controllers/fileController";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Existing routes...
router.get("/items", listItems);
router.post("/folder", createFolder);
router.put("/folder/rename", renameFolder);
router.delete("/folder", deleteFolder);
router.post("/file", saveFileMeta);
router.delete("/file", deleteFile);

// ✅ NEW upload route
router.post("/upload", upload.single("file"), uploadFile);

export default router;
