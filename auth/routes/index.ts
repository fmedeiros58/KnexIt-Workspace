import { Router } from "express";
import { login, refreshToken, profile } from "../controllers/authController";

const router = Router();

router.post("/login", login);
router.post("/refresh", refreshToken);
router.get("/profile", profile);

export default router;
