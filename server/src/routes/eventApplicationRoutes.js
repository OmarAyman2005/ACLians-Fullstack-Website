// server/src/routes/eventApplicationRoutes.js
import express from "express";
import {
  createApplication,
  listApplications,
  updateApplication,
  deleteApplication,
  getApplicationById,
  acceptApplication,
  rejectApplication,
  cancelApplication,
  getApplicationsByEventAndBooth,   // ← add this import
} from "../controllers/eventApplicationController.js";

const router = express.Router();

router.get("/", listApplications);                 // ?eventId=&userId=&status=
router.get("/by-booth", getApplicationsByEventAndBooth); // ← NEW: ?eventId=&boothNumber=
router.get("/:id", getApplicationById);
router.post("/", createApplication);
router.patch("/:id", updateApplication);
router.delete("/:id", deleteApplication);
router.post("/:id/accept", acceptApplication);
router.post("/:id/reject", rejectApplication);
router.post("/:id/cancel", cancelApplication);

export default router;
